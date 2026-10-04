// HttpOnly 관리자 세션으로 통계·사용자 검색·확인 후 투표 삭제를 처리합니다.
const houseNames = { O: "Outsight D.T", S: "서비스생산시스템", C: "컨설팅&엑셀러레이팅", A: "애자일" };
const houseColors = { O: "#e5007d", S: "#66855c", C: "#c99842", A: "#9073ae" };
const completionColors = ["#aebac8", "#9bc9ef", "#649cce", "#386eaa", "#173f73"];
const percentFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const $ = (id) => document.getElementById(id);
const timeFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
let expiresAt = 0, page = 1, total = 0, search = "", users = [], currentView = "dashboard";
let userRequest = 0, dashboardRequest = 0, pendingDelete, deleting = false, loginBusy = false;
let pendingUserLogout, userLogoutBusy = false;
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function showLogin(message = "") {
  expiresAt = 0; userRequest++; dashboardRequest++; users = [];
  $("admin-workspace").hidden = true; $("admin-login").hidden = false;
  $("admin-password").value = "";
  $("admin-users-rows").replaceChildren(); $("admin-metrics").replaceChildren();
  $("completion-chart").replaceChildren(); $("candidate-charts").replaceChildren();
  $("admin-login-error").textContent = message; $("admin-login-error").hidden = !message;
  if ($("admin-delete-dialog").open) $("admin-delete-dialog").close();
  if ($("admin-user-logout-dialog").open) $("admin-user-logout-dialog").close();
}
function notice(message) { $("admin-notice").textContent = message; $("admin-notice").hidden = !message; }
function handleError(error) {
  if (error.status === 401) showLogin("관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.");
  else notice(error.message || "불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
}
async function request(action, body = {}) {
  let response, data;
  try {
    response = await fetch(`/wic_admin/api/${action}`, { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(25000) });
    data = await response.json();
  } catch { throw new Error("연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요."); }
  if (!response.ok) { const error = new Error(data.message || "요청을 처리하지 못했습니다."); error.status = response.status; throw error; }
  if (data.expiresAt) expiresAt = Date.parse(data.expiresAt);
  return data;
}
function updateSessionTime() {
  if (!expiresAt) return;
  const minutes = Math.ceil((expiresAt - Date.now()) / 60000);
  if (minutes <= 0) { showLogin("관리자 세션이 만료되었습니다. 다시 로그인해 주세요."); return; }
  $("admin-session-time").textContent = `세션 ${minutes}분 남음`;
}
function showWorkspace() {
  $("admin-login").hidden = true; $("admin-workspace").hidden = false;
  $("admin-password").value = ""; notice(""); updateSessionTime();
}
function share(count, total) { return total ? count / total * 100 : 0; }
function percent(value) { return `${percentFormat.format(value)}%`; }
function candidateStandings(candidates) {
  const total = candidates.reduce((sum, item) => sum + item.votes, 0);
  const maximum = Math.max(0, ...candidates.map((item) => item.votes));
  const leaders = maximum ? candidates.filter((item) => item.votes === maximum) : [];
  const runnerUp = [...candidates].sort((a, b) => b.votes - a.votes)[1]?.votes || 0;
  return { total, leaders, gap: share(maximum - runnerUp, total),
    rows: candidates.map((item) => ({ ...item, percentage: share(item.votes, total),
      rank: item.votes ? 1 + candidates.filter((other) => other.votes > item.votes).length : null,
      tied: item.votes > 0 && candidates.filter((other) => other.votes === item.votes).length > 1 })) };
}
function barRow(item, color) {
  const row = node("div", undefined, "bar-row");
  const label = node("div", undefined, "bar-label"); label.append(node("span", `후보 ${item.candidate}`));
  if (item.rank) label.append(node("small", `${item.tied ? "공동 " : ""}${item.rank}위`, item.rank === 1 ? "rank-badge leader-badge" : "rank-badge"));
  const track = node("div", undefined, "bar-track"); track.setAttribute("aria-hidden", "true");
  const fill = node("div", undefined, "bar-fill"); fill.style.width = `${item.percentage}%`;
  fill.style.backgroundColor = color; track.append(fill);
  const value = node("div", undefined, "bar-total");
  value.append(node("strong", percent(item.percentage)), node("small", `${item.votes.toLocaleString()}건`));
  row.append(label, track, value);
  return row;
}
function renderCompletion(data) {
  $("completion-basis").textContent = `전체 가입자 ${data.registered.toLocaleString()}명 = 100%`;
  const stack = node("div", undefined, "completion-stack"); stack.setAttribute("aria-hidden", "true");
  const legend = node("div", undefined, "completion-legend");
  for (const item of data.completion) {
    const percentage = share(item.users, data.registered), color = completionColors[item.count];
    if (percentage) {
      const segment = node("div", undefined, "completion-segment"); segment.style.width = `${percentage}%`;
      segment.style.backgroundColor = color; stack.append(segment);
    }
    const entry = node("div", undefined, "completion-item"), label = node("div", undefined, "completion-label");
    const dot = node("span", undefined, "chart-dot"); dot.style.backgroundColor = color; dot.setAttribute("aria-hidden", "true");
    label.append(dot, node("span", item.count ? `${item.count}개 완료` : "미투표"));
    entry.append(label, node("strong", percent(percentage)), node("small", `${item.users.toLocaleString()}명`)); legend.append(entry);
  }
  $("completion-chart").replaceChildren(stack, legend);
  if (!data.registered) $("completion-chart").append(node("p", "아직 가입한 사용자가 없습니다.", "chart-empty"));
}
async function loadDashboard() {
  const sequence = ++dashboardRequest;
  const { data } = await request("dashboard");
  if (sequence !== dashboardRequest) return;
  const metrics = [["총 참여자수", data.participants, "명", "투표를 1개 이상 저장한 사용자"],
    ["전체 가입자수", data.registered, "명", "미투표 사용자 포함"],
    ["4개 투표 완료", data.completed, "명", "모든 하우스에 투표한 사용자"],
    ["총 투표 건수", data.totalVotes, "건", "DB에 저장된 유효 투표"]];
  $("admin-metrics").replaceChildren(...metrics.map(([label, count, unit, description]) => {
    const card = node("article", undefined, "metric-card");
    const value = node("div", count.toLocaleString(), "metric-value"); value.append(node("small", unit));
    card.append(node("p", label, "metric-label"), value, node("p", description, "metric-note")); return card;
  }));
  renderCompletion(data);
  $("candidate-charts").replaceChildren(...Object.entries(houseNames).map(([house, name]) => {
    const card = node("section", undefined, "chart-panel house-chart");
    const candidates = data.candidates.filter((item) => item.house === house);
    const standings = candidateStandings(candidates);
    card.style.setProperty("--house-color", houseColors[house]);
    const heading = node("div", undefined, "panel-heading");
    const title = node("div", undefined, "house-title"), dot = node("span", undefined, "chart-dot"); dot.setAttribute("aria-hidden", "true");
    title.append(dot, node("h2", name)); heading.append(title, node("span", `총 ${standings.total.toLocaleString()}건`)); card.append(heading);
    if (standings.leaders.length) {
      const summary = node("div", undefined, "leader-summary");
      summary.append(node("strong", `${standings.leaders.length > 1 ? "공동 " : ""}1위 · ${standings.leaders.map((item) => `후보 ${item.candidate}`).join(" · ")}`));
      summary.append(node("span", `${standings.leaders.length > 1 ? "각 " : ""}${percent(share(standings.leaders[0].votes, standings.total))} · ${standings.leaders.length > 1 ? "선두 간 격차" : "2위와 격차"} ${percentFormat.format(standings.gap)}%p`));
      card.append(summary);
    }
    card.append(node("p", "이 하우스의 총투표 = 100%", "chart-basis"));
    const axis = node("div", undefined, "chart-axis"); axis.setAttribute("aria-hidden", "true");
    for (const value of ["0%", "50%", "100%"]) axis.append(node("span", value)); card.append(axis);
    for (const item of standings.rows) card.append(barRow(item, houseColors[house]));
    if (!standings.total) card.append(node("p", "아직 저장된 투표가 없습니다. 득표율과 순위는 투표 후 표시됩니다.", "chart-empty"));
    return card;
  }));
}
function renderUsers() {
  $("users-total").textContent = `${total.toLocaleString()}명`;
  $("admin-users-rows").replaceChildren(...users.map(({ user, votes, createdAt }) => {
    const row = node("tr"), identity = node("td");
    identity.append(node("span", user.nickname || "닉네임 미입력", "user-name"),
      node("span", `${user.phone.slice(0,3)}-${user.phone.slice(3,7)}-${user.phone.slice(7)}`, "user-phone"),
      node("span", `가입 ${timeFormat.format(new Date(createdAt))}`, "user-created"));
    row.append(identity, node("td", `${Object.keys(votes).length}/4`));
    for (const house of Object.keys(houseNames)) {
      const cell = node("td", undefined, "vote-cell"), vote = votes[house];
      if (vote) {
        const time = node("time", timeFormat.format(new Date(vote.votedAt))); time.dateTime = vote.votedAt;
        const button = node("button", "삭제", "vote-delete"); button.type = "button";
        button.setAttribute("aria-label", `${user.nickname || user.phone.slice(-4)} · ${houseNames[house]} 투표 삭제`);
        button.addEventListener("click", () => openDelete({ user, votes }, house));
        cell.append(node("strong", `후보 ${vote.candidate}`), time, button);
      } else cell.append(node("span", "미투표", "no-vote"));
      row.append(cell);
    }
    const controls = node("td"), all = node("button", "전체 투표 삭제", "delete-all"); all.type = "button";
    all.disabled = Object.keys(votes).length === 0; all.addEventListener("click", () => openDelete({ user, votes }, null));
    const logout = node("button", "사용자 로그아웃", "user-logout"); logout.type = "button";
    logout.setAttribute("aria-label", `${user.nickname || user.phone.slice(-4)} · 사용자 로그아웃`);
    logout.addEventListener("click", () => {
      pendingUserLogout = user.id;
      $("admin-user-logout-detail").textContent = `${user.nickname || "닉네임 미입력"} · 전화번호 뒷자리 ${user.phone.slice(-4)}`;
      $("admin-user-logout-error").hidden = true;
      $("admin-user-logout-dialog").showModal();
    });
    controls.append(all, logout); row.append(controls); return row;
  }));
  if (!users.length) {
    const row = node("tr"), cell = node("td", "조회된 사용자가 없습니다."); cell.colSpan = 7; row.append(cell); $("admin-users-rows").append(row);
  }
  const pages = Math.max(1, Math.ceil(total / 25));
  $("users-page").textContent = `${page} / ${pages}`;
  $("users-prev").disabled = page <= 1; $("users-next").disabled = page >= pages;
}
async function loadUsers() {
  const sequence = ++userRequest;
  const { data } = await request("users", { search, page });
  if (sequence !== userRequest) return;
  users = data.users; total = data.total; renderUsers();
}
async function refresh() {
  $("admin-refresh").disabled = true; notice("현황을 확인하고 있어요…");
  try { await Promise.all([loadDashboard(), loadUsers()]); notice(""); }
  catch (error) { handleError(error); }
  finally { $("admin-refresh").disabled = false; }
}
function openDelete(entry, house) {
  const votes = house ? { [house]: entry.votes[house] } : entry.votes;
  pendingDelete = { userId: entry.user.id, house, expected: votes };
  $("admin-delete-title").textContent = house ? `${houseNames[house]} 투표를 삭제할까요?` : "이 사용자의 전체 투표를 삭제할까요?";
  $("admin-delete-detail").textContent = `${entry.user.nickname || "닉네임 미입력"} · 전화번호 뒷자리 ${entry.user.phone.slice(-4)}\n`
    + Object.entries(votes).map(([key, vote]) => `${houseNames[key]} · 후보 ${vote.candidate}`).join(" / ");
  $("admin-delete-reason").value = ""; $("admin-delete-error").hidden = true;
  $("admin-delete-dialog").showModal();
}
$("admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); if (loginBusy) return; loginBusy = true;
  $("admin-login-submit").disabled = true; $("admin-login-error").hidden = true;
  const password = $("admin-password").value; $("admin-password").value = "";
  try { await request("login", { password }); showWorkspace(); await refresh(); }
  catch (error) { $("admin-login-error").textContent = error.message; $("admin-login-error").hidden = false; }
  finally { loginBusy = false; $("admin-login-submit").disabled = false; }
});
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  currentView = button.dataset.view;
  $("dashboard-view").hidden = currentView !== "dashboard"; $("users-view").hidden = currentView !== "users";
  document.querySelectorAll("[data-view]").forEach((tab) => { tab.classList.toggle("active", tab === button); tab.setAttribute("aria-pressed", String(tab === button)); });
}));
$("admin-refresh").addEventListener("click", refresh);
$("admin-logout").addEventListener("click", async () => {
  try { await request("logout"); showLogin(); } catch (error) { showLogin(error.message); }
});
$("admin-search-form").addEventListener("submit", async (event) => {
  event.preventDefault(); search = $("admin-search").value.trim(); page = 1;
  try { await loadUsers(); notice(""); } catch (error) { handleError(error); }
});
$("admin-search-reset").addEventListener("click", async () => {
  $("admin-search").value = search = ""; page = 1;
  try { await loadUsers(); notice(""); } catch (error) { handleError(error); }
});
for (const [id, delta] of [["users-prev", -1], ["users-next", 1]]) $(id).addEventListener("click", async () => {
  page += delta;
  try { await loadUsers(); notice(""); } catch (error) { page -= delta; handleError(error); }
});
$("admin-delete-cancel").addEventListener("click", () => { if (!deleting) $("admin-delete-dialog").close(); });
$("admin-delete-dialog").addEventListener("cancel", (event) => { if (deleting) event.preventDefault(); });
$("admin-user-logout-cancel").addEventListener("click", () => { if (!userLogoutBusy) $("admin-user-logout-dialog").close(); });
$("admin-user-logout-dialog").addEventListener("cancel", (event) => { if (userLogoutBusy) event.preventDefault(); });
$("admin-user-logout-confirm").addEventListener("click", async () => {
  if (userLogoutBusy || !pendingUserLogout) return;
  userLogoutBusy = true;
  $("admin-user-logout-confirm").disabled = $("admin-user-logout-cancel").disabled = true;
  $("admin-user-logout-error").hidden = true;
  try {
    await request("logout-user", { userId: pendingUserLogout });
    $("admin-user-logout-dialog").close(); pendingUserLogout = undefined;
    notice("사용자의 기존 자동로그인을 해제했습니다. 가입 정보와 투표 내역은 유지됩니다.");
  } catch (error) {
    if (error.status === 401) handleError(error);
    else { $("admin-user-logout-error").textContent = error.message; $("admin-user-logout-error").hidden = false; }
  } finally {
    userLogoutBusy = false;
    $("admin-user-logout-confirm").disabled = $("admin-user-logout-cancel").disabled = false;
  }
});
$("admin-delete-confirm").addEventListener("click", async () => {
  if (deleting || !pendingDelete) return;
  deleting = true; $("admin-delete-confirm").disabled = $("admin-delete-cancel").disabled = true;
  $("admin-delete-error").hidden = true;
  try {
    const { data } = await request("delete", { ...pendingDelete, reason: $("admin-delete-reason").value.trim() });
    $("admin-delete-dialog").close(); pendingDelete = undefined;
    await refresh(); notice(`${data.deleted}건의 투표를 삭제했습니다. 사용자는 해당 하우스에 다시 투표할 수 있습니다.`);
  } catch (error) {
    if (error.status === 401) handleError(error);
    else { $("admin-delete-error").textContent = error.message; $("admin-delete-error").hidden = false; }
  } finally { deleting = false; $("admin-delete-confirm").disabled = $("admin-delete-cancel").disabled = false; }
});
setInterval(updateSessionTime, 15000);
(async () => {
  try { await request("session"); showWorkspace(); await refresh(); }
  catch (error) { if (error.status !== 401) showLogin(error.message); }
})();
