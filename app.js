// 빌리지·후보 보드·투표 현황을 표시하고 투표 및 임시 데이터 도구를 관리합니다.
const rooms = {
  O: {
    description: "서재", image: "asset/O_house.png",
    voteBounds: [38.7, 86.4, 22.8, 10.3],
    panels: [
      [[30.5, 20.7], [40, 16.7], [40, 45.4], [30.5, 49]],
      [[46, 14.7], [56.4, 14.7], [56.4, 42.6], [46, 42.6]],
      [[63.5, 16.8], [73.5, 20.7], [73.5, 49.8], [63.5, 45.6]],
    ],
    tabs: [[13.122, 8.656, 25.622, 14.733], [38.881, 8.656, 26.45, 14.733], [65.401, 8.656, 27.003, 14.733]],
  },
  S: {
    description: "음악 공간", image: "asset/S_house.png",
    voteBounds: [38.4, 84, 23, 11],
    panels: [
      [[26.5, 20.8], [36.3, 16.8], [36.3, 43.5], [26.5, 47.8]],
      [[38.5, 14.8], [48.4, 14], [48.4, 40.5], [38.5, 41.5]],
      [[51.2, 14], [61.2, 16], [61.2, 42], [51.2, 39.9]],
      [[63.8, 17.5], [73.7, 20.8], [73.7, 47.7], [63.8, 43.8]],
    ],
    tabs: [[11, 10.5, 19, 11.5], [30.5, 10.5, 19, 11.5], [50.2, 10.5, 19, 11.5], [69.8, 10.5, 19, 11.5]],
  },
  C: {
    description: "카페", image: "asset/C_house.png",
    voteBounds: [38.1, 83.6, 23.2, 9.9],
    panels: [
      [[28.5, 20.5], [38.8, 16.8], [38.8, 41.6], [28.5, 45]],
      [[42.4, 15.5], [54.5, 15.6], [54.5, 40.5], [42.4, 40.5]],
      [[58.8, 16.7], [69.5, 20.5], [69.5, 45], [58.8, 41]],
    ],
    tabs: [[11.533, 8.471, 24.171, 12.891], [37.5, 8.287, 25.414, 13.168], [64.365, 8.379, 24.793, 13.168]],
  },
  A: {
    description: "캠핑 공간", image: "asset/A_house.png",
    voteBounds: [37.4, 85.7, 25, 10.9],
    panels: [
      [[29.3, 18.5], [40.8, 16], [40.8, 44], [29.3, 46.3]],
      [[43.2, 14], [55.5, 14], [55.5, 40.6], [43.2, 40.6]],
      [[59, 16.3], [70.1, 19.5], [70.1, 47], [59, 43.5]],
    ],
    tabs: [[10.843, 5.433, 24.309, 13.26], [37.707, 5.433, 25.069, 13.26], [64.572, 5.433, 25.483, 13.444]],
  },
};

const scene = document.getElementById("scene");
const sceneImage = document.getElementById("scene-image");
const entrances = document.getElementById("entrances");
const mobileEntrances = document.getElementById("mobile-entrances");
const backLink = document.getElementById("back-link");
const screenTitle = document.getElementById("screen-title");
const announcement = document.getElementById("announcement");
const candidatePanels = document.getElementById("candidate-panels");
const candidateDialog = document.getElementById("candidate-dialog");
const boardImage = document.getElementById("board-image");
const boardTitle = document.getElementById("board-title");
const boardTabs = document.getElementById("board-tabs");
const boardContent = document.getElementById("board-content");
const boardClose = document.getElementById("board-close");
const boardVote = document.getElementById("board-vote");
const boardVoteLabel = document.getElementById("board-vote-label");
const boardVoteStatus = document.getElementById("board-vote-status");
const voteDialog = document.getElementById("vote-dialog");
const voteHeading = document.getElementById("vote-heading");
const voteMessage = document.getElementById("vote-message");
const voteDetail = document.getElementById("vote-detail");
const voteYes = document.getElementById("vote-yes");
const voteNo = document.getElementById("vote-no");
const roomVotedSign = document.getElementById("room-voted-sign");
const roomVotedDetail = document.getElementById("room-voted-detail");
const villageStatus = document.getElementById("village-status");
const villageVoteSummary = document.getElementById("village-vote-summary");
const localDataOpen = document.getElementById("local-data-open");
const localDataDialog = document.getElementById("local-data-dialog");
const localDataRows = document.getElementById("local-data-rows");
const localDataRaw = document.getElementById("local-data-raw");
const localDataResult = document.getElementById("local-data-result");
const localDataReset = document.getElementById("local-data-reset");
const resetConfirm = document.getElementById("reset-confirm");
const resetNo = document.getElementById("local-data-reset-no");
let voteStep;
let pendingVote;
let nextHouse;
let previousHouse;
let currentHouse;
let boardRequest = 0;

// 후보 데이터는 방별·후보별로 분리하며 실제 내용은 추후 작성합니다.
for (const room of Object.values(rooms)) {
  room.candidates = room.panels.map((points) => ({ points, content: "" }));
}

function positionElement(element, [left, top, width, height]) {
  Object.assign(element.style, {
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
  });
}

function renderCandidates(room) {
  candidatePanels.replaceChildren();
  if (!room) return;
  room.candidates.forEach(({ points }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-panel";
    button.setAttribute("aria-label", `후보 ${index + 1} 상세 보기`);
    button.setAttribute("aria-haspopup", "dialog");
    const left = Math.min(...points.map(([x]) => x));
    const top = Math.min(...points.map(([, y]) => y));
    const width = Math.max(...points.map(([x]) => x)) - left;
    const height = Math.max(...points.map(([, y]) => y)) - top;
    positionElement(button, [left, top, width, height]);
    button.style.clipPath = `polygon(${points.map(([x, y]) =>
      `${(x - left) / width * 100}% ${(y - top) / height * 100}%`).join(",")})`;
    button.addEventListener("click", () => openCandidateBoard(index));
    candidatePanels.append(button);
  });
}

function selectCandidate(index, focus = false) {
  const room = rooms[currentHouse];
  boardTabs.querySelectorAll("button").forEach((tab, tabIndex) => {
    const selected = tabIndex === index;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  boardTitle.textContent = `${currentHouse} 집 · 후보 ${index + 1}`;
  boardContent.dataset.house = currentHouse;
  boardContent.dataset.candidate = String(index + 1);
  boardContent.setAttribute("aria-labelledby", `candidate-tab-${index + 1}`);
  boardContent.textContent = room.candidates[index].content;
}

async function openCandidateBoard(index) {
  const request = ++boardRequest;
  const room = rooms[currentHouse];
  boardImage.src = `asset/${currentHouse}_desc_board_vote.png`;
  positionElement(boardVote, room.voteBounds);
  refreshVoteStatus();
  boardTabs.replaceChildren();
  room.tabs.forEach((bounds, tabIndex) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "candidate-tab";
    tab.id = `candidate-tab-${tabIndex + 1}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-label", `후보 ${tabIndex + 1}`);
    tab.setAttribute("aria-controls", "board-content");
    positionElement(tab, bounds);
    const badge = document.createElement("span");
    badge.className = "selection-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = "✓ 선택";
    tab.append(badge);
    tab.addEventListener("click", () => selectCandidate(tabIndex));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (tabIndex + 1) % room.tabs.length;
      if (event.key === "ArrowLeft") next = (tabIndex + room.tabs.length - 1) % room.tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = room.tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectCandidate(next, true);
      }
    });
    boardTabs.append(tab);
  });
  selectCandidate(index);
  try {
    await boardImage.decode();
  } catch {
    if (request === boardRequest) announcement.textContent = "후보 보드를 불러오지 못했습니다. 다시 눌러 주세요.";
    return;
  }
  if (request !== boardRequest || candidateDialog.open) return;
  candidateDialog.showModal();
  boardTabs.children[index].focus({ preventScroll: true });
}

boardClose.addEventListener("click", () => candidateDialog.close());
candidateDialog.addEventListener("click", (event) => {
  if (event.target === candidateDialog) candidateDialog.close();
});

function refreshVoteStatus() {
  try {
    const votes = voteStore.read(window.localStorage);
    renderCompletionSigns(votes);
    const vote = votes[currentHouse];
    boardVote.disabled = Boolean(vote);
    boardVoteLabel.textContent = vote ? "투표 완료" : "";
    boardVote.setAttribute("aria-label", vote ? "투표 완료" : "투표하기");
    boardVoteStatus.textContent = vote ? `${currentHouse} 하우스 · 후보 ${vote.candidate}에게 투표했습니다.` : "";
    boardVoteStatus.hidden = !vote;
  } catch {
    renderCompletionSigns({});
    villageVoteSummary.textContent = "로컬 투표 기록을 확인할 수 없습니다.";
    boardVote.disabled = true;
    boardVoteLabel.textContent = "저장 확인 필요";
    boardVote.setAttribute("aria-label", "저장 확인 필요");
    boardVoteStatus.textContent = "저장된 투표를 읽지 못했습니다. 브라우저의 저장 설정을 확인한 뒤 새로고침해 주세요.";
    boardVoteStatus.hidden = false;
  }
}

function renderCompletionSigns(votes) {
  for (const house of Object.keys(rooms)) {
    const vote = votes[house];
    const entrance = entrances.querySelector(`[href="#house/${house}"]`);
    entrance.querySelector(".house-voted-sign").hidden = !vote;
    entrance.setAttribute("aria-label", `${house} 집으로 들어가기${vote ? " · 투표 완료" : ""}`);
    const mobileLink = mobileEntrances.querySelector(`[href="#house/${house}"]`);
    mobileLink.querySelector(".mobile-voted-label").hidden = !vote;
    mobileLink.classList.toggle("has-voted", Boolean(vote));
  }
  const vote = votes[currentHouse];
  roomVotedSign.hidden = !vote;
  roomVotedDetail.textContent = vote ? `후보 ${vote.candidate}에게 한 표` : "";
  if (vote) {
    const [leftTop, rightTop] = rooms[currentHouse].panels[vote.candidate - 1];
    roomVotedSign.style.left = `${(leftTop[0] + rightTop[0]) / 2}%`;
    roomVotedSign.style.top = `${Math.min(leftTop[1], rightTop[1])}%`;
  }
  villageVoteSummary.textContent = `${Object.keys(votes).length} / 4 하우스 투표 완료`;
}

function renderLocalData() {
  localDataRows.replaceChildren();
  localDataRaw.textContent = "저장 원문을 읽을 수 없습니다.";
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(voteStore.key);
    localDataRaw.textContent = raw === null ? "저장된 투표 데이터가 없습니다." : raw;
    const votes = voteStore.read(storage);
    for (const house of Object.keys(rooms)) {
      const vote = votes[house];
      const date = vote ? new Date(vote.votedAt) : undefined;
      const row = document.createElement("tr");
      for (const value of [house, vote ? `후보 ${vote.candidate}` : "미투표",
        date && Number.isFinite(date.getTime()) ? date.toLocaleString("ko-KR") : "—"]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      localDataRows.append(row);
    }
  } catch {
    localDataResult.textContent = "투표 기록을 읽지 못했습니다. 저장 원문을 확인하거나 초기화해 주세요.";
  }
}

localDataOpen.addEventListener("click", () => {
  localDataResult.textContent = "";
  resetConfirm.hidden = true;
  localDataReset.hidden = false;
  renderLocalData();
  localDataDialog.showModal();
});
document.getElementById("local-data-close").addEventListener("click", () => localDataDialog.close());
localDataDialog.addEventListener("click", (event) => {
  if (event.target === localDataDialog) localDataDialog.close();
});
localDataReset.addEventListener("click", () => {
  resetConfirm.hidden = false;
  localDataReset.hidden = true;
  resetNo.focus();
});
resetNo.addEventListener("click", () => {
  resetConfirm.hidden = true;
  localDataReset.hidden = false;
  localDataReset.focus();
});
document.getElementById("local-data-reset-yes").addEventListener("click", () => {
  try {
    voteStore.reset(window.localStorage);
  } catch {
    localDataResult.textContent = "초기화하지 못했습니다. 브라우저의 저장 설정을 확인해 주세요.";
    return;
  }
  resetConfirm.hidden = true;
  localDataReset.hidden = false;
  refreshVoteStatus();
  renderLocalData();
  localDataResult.textContent = "투표 기록을 초기화했습니다. 다시 투표할 수 있습니다.";
  localDataReset.focus();
});

function showVotePrompt(step, heading, message, detail) {
  voteStep = step;
  voteHeading.textContent = heading;
  voteMessage.textContent = message;
  voteDetail.textContent = detail;
  voteNo.hidden = step === "complete" || step === "error" || step === "duplicate";
  voteYes.textContent = step === "complete" ? "마을로 돌아가기" : voteNo.hidden ? "확인" : "예";
  if (!voteDialog.open) voteDialog.showModal();
  voteYes.focus({ preventScroll: true });
}

boardVote.addEventListener("click", () => {
  pendingVote = { house: currentHouse, candidate: Number(boardContent.dataset.candidate) };
  showVotePrompt("confirm", "투표 확인",
    `${pendingVote.house} 하우스의 후보 ${pendingVote.candidate}에게 투표를 하시겠습니까?`,
    "하우스별로 한 번만 투표할 수 있으며, 저장 후에는 변경할 수 없습니다.");
});

function goTo(house) {
  voteDialog.close();
  candidateDialog.close();
  location.hash = house ? `#house/${house}` : "#village";
}

voteYes.addEventListener("click", () => {
  if (voteStep === "confirm") {
    let result;
    try {
      result = voteStore.save(window.localStorage, pendingVote.house, pendingVote.candidate);
    } catch {
      showVotePrompt("error", "저장 실패", "투표를 저장하지 못했습니다.",
        "투표는 완료되지 않았습니다. 브라우저의 저장 설정을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    refreshVoteStatus();
    if (!result.saved) {
      showVotePrompt("duplicate", "투표 완료", "이미 투표한 하우스입니다.",
        `후보 ${result.votes[pendingVote.house].candidate}에게 한 최초 투표를 유지합니다.`);
      return;
    }
    nextHouse = voteStore.nextHouse(result.votes);
    const detail = `${pendingVote.house} 하우스의 후보 ${pendingVote.candidate}에게 투표가 저장되었습니다. (${Object.keys(result.votes).length}/4 완료)`;
    if (nextHouse) {
      showVotePrompt("next", "투표 완료", `${nextHouse} 하우스에 투표하러 이동하시겠습니까?`, detail);
    } else {
      showVotePrompt("complete", "투표 완료", "모든 하우스에 투표를 마쳤습니다.", detail);
    }
  } else if (voteStep === "next") {
    goTo(nextHouse);
  } else if (voteStep === "complete") {
    goTo();
  } else {
    voteDialog.close();
  }
});

function declineVotePrompt() {
  if (voteStep === "next" || voteStep === "complete") goTo();
  else voteDialog.close();
}
voteNo.addEventListener("click", declineVotePrompt);
voteDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  declineVotePrompt();
});
window.addEventListener("storage", (event) => {
  if (event.key === voteStore.key || event.key === null) {
    refreshVoteStatus();
    if (localDataDialog.open) {
      localDataResult.textContent = "";
      renderLocalData();
    }
  }
});

function renderScreen() {
  const house = location.hash.match(/^#house\/([OSCA])$/)?.[1];
  const room = rooms[house];
  const title = room ? `${house} 집 · 오스카 빌리지` : "오스카 빌리지";

  if (voteDialog.open) voteDialog.close();
  if (localDataDialog.open) localDataDialog.close();
  if (candidateDialog.open) candidateDialog.close();
  pendingVote = undefined;
  boardRequest += 1;
  currentHouse = house;
  renderCandidates(room);
  candidatePanels.hidden = !room;

  sceneImage.src = room ? room.image : "asset/OSCA_home.png";
  sceneImage.width = room ? 1448 : 2613;
  sceneImage.height = room ? 1086 : 1471;
  sceneImage.alt = room
    ? `${house} 집 내부. ${room.description}에 후보 현판 ${house === "S" ? 4 : 3}개가 있습니다.`
    : "오스카 빌리지. 왼쪽부터 O, S, C, A 집이 자리하고 있습니다.";
  scene.style.setProperty("--scene-ratio", room ? "1.333333" : "1.776343");
  entrances.hidden = Boolean(room);
  mobileEntrances.hidden = Boolean(room);
  backLink.hidden = !room;
  villageStatus.hidden = Boolean(room);
  scene.classList.toggle("is-village", !room);
  refreshVoteStatus();
  screenTitle.textContent = title;
  document.title = title;
  announcement.textContent = room ? `${house} 집에 들어왔습니다.` : "오스카 빌리지입니다.";

  if (room) {
    backLink.focus({ preventScroll: true });
  } else if (previousHouse) {
    entrances.querySelector(`[href="#house/${previousHouse}"]`).focus({ preventScroll: true });
  }
  previousHouse = house;
}

window.addEventListener("hashchange", renderScreen);
renderScreen();
