// DB 투표 API와 자동로그인 사용자 정보만 관리합니다.
const voteStore = (() => {
  const key = "osca.user.v1";
  const legacyKey = "osca.votes.v1";
  const counts = { O: 3, S: 4, C: 3, A: 3 };
  const order = Object.keys(counts);
  const retryMessage = "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";

  function validateIdentity({ phone, nickname = "" }) {
    phone = String(phone ?? "").replace(/[-\s]/g, "");
    nickname = String(nickname ?? "").trim().normalize("NFC");
    if (!/^010\d{8}$/.test(phone)) throw new Error("010으로 시작하는 휴대전화 번호 11자리를 입력해 주세요.");
    if (nickname && !/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,6}$/.test(nickname)) {
      throw new Error("닉네임은 한글, 영문, 숫자로 6자까지 입력해 주세요. 공백과 특수문자는 사용할 수 없어요.");
    }
    return { phone, nickname: nickname || null };
  }
  function validVote(house, candidate) {
    return Object.hasOwn(counts, house) && Number.isInteger(candidate) && candidate >= 1 && candidate <= counts[house];
  }
  const nextHouse = (votes) => order.find((house) => !votes[house]);

  function createClient({ endpoint, storage, fetchImpl = fetch, onChange = () => {} }) {
    let state = { user: null, votes: {}, status: "guest", error: "", storageWarning: "" };
    let restoreRequest = 0;
    const emit = (changes) => { state = { ...state, ...changes }; onChange(state); };
    function storageFailure() {
      emit({ storageWarning: "이 브라우저에서는 로그인 정보를 보관할 수 없어요. 다음 방문에는 전화번호를 다시 입력해 주세요." });
    }
    function clearUser() {
      try { storage.removeItem(key); } catch { storageFailure(); }
      emit({ user: null, votes: {}, status: "guest", error: "" });
    }
    function readUser() {
      let raw;
      try { raw = storage.getItem(key); } catch { storageFailure(); return null; }
      if (!raw) return null;
      try {
        const user = JSON.parse(raw);
        if (!user || typeof user.phone !== "string") throw new Error("invalid user");
        return { ...user, ...validateIdentity({ phone: user.phone }) };
      } catch { clearUser(); return null; }
    }
    function checkedSnapshot(data) {
      if (!data || !['found', 'missing', 'new', 'saved', 'duplicate'].includes(data.status)
          || !data.votes || typeof data.votes !== "object" || Array.isArray(data.votes)) throw new Error(retryMessage);
      if (!data.user) {
        if (Object.keys(data.votes).length || data.status !== "missing") throw new Error(retryMessage);
        return data;
      }
      if (typeof data.user.id !== "string" || !/^010\d{8}$/.test(data.user.phone)) throw new Error(retryMessage);
      validateIdentity(data.user);
      for (const [house, vote] of Object.entries(data.votes)) {
        if (!vote || !validVote(house, vote.candidate) || !Number.isFinite(Date.parse(vote.votedAt))) throw new Error(retryMessage);
      }
      return data;
    }
    async function request(action, identity, vote = {}) {
      if (!endpoint) throw new Error("연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.");
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, phone: identity.phone, nickname: identity.nickname, ...vote }),
          signal: AbortSignal.timeout(15000), cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || retryMessage);
        const result = checkedSnapshot(data);
        if (result.user && result.user.phone !== identity.phone) throw new Error(retryMessage);
        return result;
      } catch (error) {
        if (error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError || error instanceof SyntaxError) throw new Error(retryMessage);
        throw error;
      }
    }
    function adopt(data) {
      checkedSnapshot(data);
      restoreRequest += 1;
      if (!data.user) { clearUser(); return data; }
      const identity = validateIdentity(data.user);
      const user = { id: data.user.id, ...identity };
      try { storage.setItem(key, JSON.stringify(user)); } catch { storageFailure(); }
      emit({ user, votes: data.votes, status: "ready", error: "" });
      return data;
    }
    async function restore() {
      const requestId = ++restoreRequest;
      try { storage.removeItem(legacyKey); } catch { /* 기존 투표는 어떤 경우에도 읽거나 사용하지 않습니다. */ }
      const user = readUser() || (state.storageWarning ? state.user : null);
      if (!user) { emit({ user: null, votes: {}, status: "guest", error: "" }); return; }
      emit({ status: "checking", error: "" });
      try {
        const data = await request("lookup", user);
        if (requestId !== restoreRequest) return;
        adopt(data);
      } catch (error) {
        if (requestId === restoreRequest) emit({ status: "error", error: error.message, votes: {} });
        throw error;
      }
    }
    async function lookup(input) { return request("lookup", validateIdentity(input)); }
    async function login(input) {
      const identity = validateIdentity(input);
      let data;
      try { data = await request("login", identity); }
      catch (error) {
        const recovered = await request("lookup", identity).catch(() => null);
        if (!recovered?.user) throw error;
        data = recovered;
      }
      return adopt(data);
    }
    async function vote(identity, house, candidate) {
      if (!validVote(house, candidate)) throw new Error("투표할 후보를 다시 확인해 주세요.");
      const normalized = validateIdentity(identity);
      let data;
      try { data = await request("vote", normalized, { house, candidate, userId: identity.id ?? null }); }
      catch (error) {
        const recovered = await request("lookup", normalized).catch(() => null);
        if (!recovered?.user || !recovered.votes[house]) throw error;
        data = { ...recovered, status: "duplicate", recovered: true };
      }
      return adopt(data);
    }
    return { get state() { return state; }, restore, lookup, login, vote, adopt };
  }
  return { key, legacyKey, validateIdentity, validVote, nextHouse, createClient };
})();

if (typeof module !== "undefined") module.exports = voteStore;
