// 하우스별 최초 투표를 저장하고 다음 미투표 하우스를 찾습니다.
const voteStore = (() => {
  const key = "osca.votes.v1";
  const candidateCounts = { O: 3, S: 4, C: 3, A: 3 };
  const order = Object.keys(candidateCounts);

  function read(storage) {
    const data = JSON.parse(storage.getItem(key) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("저장된 투표 형식을 확인할 수 없습니다.");
    }
    const votes = {};
    for (const house of order) {
      const record = data[house];
      if (record && Number.isInteger(record.candidate) &&
          record.candidate >= 1 && record.candidate <= candidateCounts[house]) {
        votes[house] = { candidate: record.candidate, votedAt: record.votedAt };
      }
    }
    return votes;
  }

  function save(storage, house, candidate) {
    if (!order.includes(house) || !Number.isInteger(candidate) ||
        candidate < 1 || candidate > candidateCounts[house]) {
      throw new Error("투표할 하우스와 후보를 확인해 주세요.");
    }
    const votes = read(storage);
    if (votes[house]) return { saved: false, votes };
    votes[house] = { candidate, votedAt: new Date().toISOString() };
    storage.setItem(key, JSON.stringify(votes));
    return { saved: true, votes };
  }

  function nextHouse(votes) {
    return order.find((house) => !votes[house]);
  }

  return { read, save, nextHouse };
})();

if (typeof module !== "undefined") module.exports = voteStore;
