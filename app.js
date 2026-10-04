// 빌리지·후보 소개 보드·투표 현황을 표시하고 투표 및 임시 데이터 도구를 관리합니다.
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
    introductions: [
      {
        title: "AI활용 빠른 검증",
        subtitle: "U+one AI Agent 오픈",
        quote: ["“고객이 말하는 순간,", "상담사처럼 Simple하게 해결”"],
        activities: [
          "상담사 인터뷰와 데이터 분석으로 고객의 진짜 니즈 발견",
          "AI를 활용해 프로토타입을 빠르게 제작, 상담사 경험으로 구현",
          "실제 유저 테스트와 AI 페르소나 Agent로 이중 검증하며 완성도를 높임",
        ],
      },
      {
        title: "467명 고객 목소리 기반",
        subtitle: "비개발자들이 출시한 서비스",
        quote: ["“467명의 고객 목소리를", "서비스 출시로 바꿔낸 실행력”"],
        activities: [
          "2주 만에 심층 인터뷰, 설문, 사용성 테스트를 통해 고객 문제와 니즈를 데이터로 검증",
          "비개발자, 비기획자가 AI & 바이브 코딩으로 서비스 기획·개발·출시까지 이뤄낸 Growth mindset",
          "고객 검증부터 실제 출시까지 1개월 내 완주",
        ],
      },
      {
        title: "제휴 방법론 혁신",
        subtitle: "10X 사업기회 발굴",
        quote: ["“제휴사를 고객으로 다시 보자", "새로운 사업기회가 열렸다”"],
        activities: [
          "DT 방법론으로 제휴 담당자의 질문 자체를 전환해, 제휴사의 숨은 페인 포인트와 니즈 발굴",
          "새로운 접근법으로 기존엔 접점이 없던 이종 산업까지 제휴 대상 확장",
          "전파 교육을 통해 개인의 경험을 조직 전체의 일하는 방식으로 확산",
        ],
      },
    ],
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
    introductions: [
      {
        quote: ["“익시오 서비스 개발 시스템", "표준화 체계 구축”"],
        activities: [
          "익시오 서비스 개발 시스템(Confluence, Jira) 표준화 체계 구축",
          "모든 이해관계자가 업무 현황에 대해 동일한 해석을 할 수 있도록 WorkFlow 관리를 위한 Jira Standard set 설계 및 구현",
          "구축된 표준 체계 타 조직 전파 및 타 조직에서 벤치마킹",
        ],
        summary: { lead: "표준화", text: "전파·벤치마킹" },
      },
      {
        quote: ["“처음부터 끝까지 실행한", "최초 프로젝트 PO”"],
        activities: [
          "서비스생산시스템 전 과정 최초 실행",
          "출시 전 결정부터 출시 후 고객 변화와 피드백 반영까지 실행",
          "완벽히 이해하지 못한 부분은 학습하며 실전에 적용",
          "실행하며 얻은 6가지 Lesson Learn을 공유, 조직의 공통 자산으로 체계화",
        ],
        summary: { lead: "6가지", text: "Lesson Learn 체계화" },
      },
      {
        quote: ["“변화의 의미를 먼저 이해하고", "사람들을 변화의 여정으로 이끈 리더”"],
        activities: [
          "서비스생산시스템을 누구보다 먼저 학습하고 현업 언어로 재해석해 조직 이해도 향상에 기여",
          "변화에 대한 우려를 경청하고 서비스생산시스템의 지향점을 설명하며 기업부문 내 공감대 형성",
          "현장의 문제 해결을 지원하며 변화 수용성과 실행력을 높이는 역할 수행",
          "리더와 구성원을 연결하는 가교 역할로 서비스생산시스템의 현장 정착과 실행 촉진",
        ],
        summary: { lead: "변화 확산", text: "Change Leader" },
      },
      {
        quote: ["“흩어진 업무가", "하나의 목표로 연결되는 순간”"],
        activities: [
          "통합 JIRA를 실행 기반으로 정비하며 전략, 목표, 업무를 하나의 흐름으로 연결",
          "자신의 업무가 어떤 목표와 고객 가치에 연결되는지 확인할 수 있는 공통 기준 마련",
          "반복적인 확인과 업무 인계 과정에서의 혼선과 비효율을 줄이는 업무 관리 환경 조성",
          "일의 흐름을 투명하게 공유하고, 조직이 같은 방향을 바라보며 협업할 수 있는 기반 구축",
        ],
        summary: { lead: "통합 JIRA", text: "실행 기반 구축" },
      },
    ],
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
    introductions: [
      {
        title: "프로토타입 개발", titleNote: "비개발자 출신",
        subtitle: "사용성 테스트 수행 완료",
        quote: ["“콘텐츠 소비를 넘어, TV와 대화하며 즐기는", "고객 경험 설계! 2주간의 혁신”"],
        activities: [
          "고객 문제 및 가치 탐색을 위한 Design Thinking 방법론 전 과정 직접 실행(타깃 고객 8인 심층 인터뷰)",
          "AI 기반 대화형 TV 서비스 프로토타입 2주 만에 자체 구현",
          "UT(사용성 테스트) 7회 진행으로 가설 검증 및 개선 과제 도출 完",
        ],
      },
      {
        title: "과제 4건 완료", titleNote: "연내 추가 1건 예정",
        subtitle: "실행 역량 내재화",
        quote: ["“감(感)이나 공급자 관점을 버리고", "진짜 고객의 불편을 찾아 떠난 60일의 여정”"],
        activities: [
          "기존 가설, 내부 의견을 버리고 데이터 분석을 통한 고객 문제 재정의(이용 패턴 100건 분석, 고객 인터뷰 6명)",
          "고객 섭외부터 인터뷰, 결과 분석까지 전 팀원이 직접 수행",
          "즉시 개선 및 실행 가능한 Quick-Win 과제 5건 도출",
        ],
      },
      {
        title: "해외 첫 광고 실험", titleNote: "사내 최초",
        subtitle: "글로벌 시장 인사이트 확보",
        quote: ["“글로벌 서비스, 글로벌 고객에게 먼저 묻다.", "고객에 직접 닿기 위한 Smoke Test에 도전”"],
        activities: [
          "타깃 국가 고객 문제·니즈를 분석하고 검증할 핵심 가치 도출",
          "국내·프랑스 고객向 광고 및 랜딩 페이지 직접 제작·개발",
          "스모크 테스트를 통해 고객 유입·반응 수집 및 심층 분석",
          "국가별 시장 특성 학습 및 실험을 통한 현지 최적화 역량 내재화",
        ],
      },
    ],
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
    introductions: [
      {
        quote: ["“AI 기반 협업으로 역할의 경계를 허물고,", "도전과 학습의 문화로 고객 가치를 확장한 스쿼드”"],
        activities: [
          "AI 기반 협업으로 역할의 경계를 넘어 업무 혁신 추진",
          "구성원의 운영 로테이션과 노하우 공유로 병목 없는 협업 체계 구축",
          "생산량 4.7배 향상, 리드타임 80% 단축, 운영비 30% 절감",
          "실패와 도전을 응원하고, 시도 후 Lesson을 통해 성장하는 회고 문화와 고객 중심 개선으로 NPS 9점 → 36점 향상",
        ],
        metrics: [["리드타임", "5일→2일"], ["생산량", "4.7배↑"], ["운영비", "30%↓"]],
      },
      {
        quote: ["“고객의 목소리를 출발점으로, 초기부터 원팀 협업으로", "고객 가치와 서비스 품질을 높인 스쿼드”"],
        activities: [
          "고객 조사, 인터뷰, 테스트 등 고객 검증 기반 의사 결정 체계 정립",
          "고객 피드백을 기반으로 개선 과제와 서비스 방향을 도출하는 문화 정착",
          "소수(4명) 인원 한계를 넘어 35회 스프린트 운영을 이루어낸 고효율 협업 체계",
          "기획·개발·UX·품질의 초기 협업으로 일정과 품질을 동시에 확보",
        ],
        metrics: [["스프린트 운영", "35회"], ["원팀 협업", "체계 정착"], ["고객 검증 기반", "문화 정착"]],
      },
      {
        quote: ["“고객 검증, 기술 전문성, 빠른 실행을 바탕으로", "사업의 가능성을 성과로 증명한 스쿼드”"],
        activities: [
          "고객 인터뷰와 사용성 검증을 기반으로 고객 중심 의사 결정 체계 구축",
          "AI 기반 개발 체계로 추가 인력 없이 핵심 기능 개발 및 개발 기간 17% 단축",
          "월 2회 스프린트와 월 1회 배포로 고객 요구를 빠르게 반영하는 실행 체계 정착",
          "PoC 고객의 50%를 유료 고객으로 전환하고 고객 계정 363% 성장을 달성하며 사업 성과 입증",
        ],
        metrics: [["PoC 고객", "50%↑"], ["고객 계정", "363%↑"], ["국내외 최초", "CSAP 인증"]],
      },
    ],
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
const boardScrollHint = document.getElementById("board-scroll-hint");
const boardContentObserver = new ResizeObserver(updateScrollHint);
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

// 소개가 준비된 하우스만 후보 순서에 맞춰 연결합니다.
for (const room of Object.values(rooms)) {
  room.candidates = room.panels.map((points, index) => ({
    points, content: room.introductions?.[index],
  }));
}

function renderIntroduction(content) {
  boardContentObserver.disconnect();
  boardContentObserver.observe(boardContent);
  boardContent.replaceChildren();
  if (!content) return;
  const article = document.createElement("article");
  article.className = "candidate-introduction";
  if (content.title) {
    const title = document.createElement("h3");
    title.className = "introduction-title";
    title.textContent = content.title;
    if (content.titleNote) {
      const note = document.createElement("span");
      note.className = "introduction-title-note";
      note.textContent = content.titleNote;
      title.append(" ", note);
    }
    article.append(title);
  }
  if (content.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "introduction-subtitle";
    subtitle.textContent = content.subtitle;
    article.append(subtitle);
  }
  const quote = document.createElement("p");
  quote.className = "introduction-quote";
  const activities = document.createElement("ul");
  activities.className = "introduction-activities";
  for (const line of content.quote) {
    const span = document.createElement("span");
    span.textContent = line;
    quote.append(span);
  }
  for (const activity of content.activities) {
    const item = document.createElement("li");
    item.textContent = activity;
    activities.append(item);
  }
  article.append(quote, activities);
  if (content.summary) {
    const summary = document.createElement("p");
    summary.className = "introduction-summary";
    const lead = document.createElement("strong");
    lead.textContent = content.summary.lead;
    summary.append(lead, ` ${content.summary.text}`);
    article.append(summary);
  }
  if (content.metrics) {
    const metrics = document.createElement("dl");
    metrics.className = "introduction-metrics";
    for (const [label, value] of content.metrics) {
      const metric = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      metric.append(term, detail);
      metrics.append(metric);
    }
    article.append(metrics);
  }
  boardContent.append(article);
  boardContentObserver.observe(article);
}

function updateScrollHint() {
  const overflow = boardContent.scrollHeight - boardContent.clientHeight;
  const atBottom = overflow - boardContent.scrollTop <= 2;
  boardScrollHint.hidden = !candidateDialog.open || !boardContent.firstElementChild || overflow <= 2;
  boardScrollHint.dataset.direction = atBottom ? "up" : "down";
  boardScrollHint.firstElementChild.textContent = atBottom ? "↑" : "↓";
  boardScrollHint.setAttribute("aria-label", atBottom ? "소개 내용 최상단으로 이동" : "소개 내용 최하단으로 이동");
}
boardContent.addEventListener("scroll", updateScrollHint, { passive: true });
candidateDialog.addEventListener("close", updateScrollHint);
boardScrollHint.addEventListener("click", () => {
  boardContent.scrollTo({
    top: boardScrollHint.dataset.direction === "up" ? 0 : boardContent.scrollHeight,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
});

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
  renderIntroduction(room.candidates[index].content);
  boardContent.scrollTop = 0;
  updateScrollHint();
}

async function openCandidateBoard(index) {
  const request = ++boardRequest;
  const room = rooms[currentHouse];
  candidateDialog.dataset.house = currentHouse;
  const [lastTabLeft, , lastTabWidth] = room.tabs.at(-1);
  candidateDialog.style.setProperty("--board-content-right", `${100 - lastTabLeft - lastTabWidth}%`);
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
  boardContent.scrollTo({ top: 0, behavior: "instant" });
  updateScrollHint();
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
