// PC・노트북・태블릿 가로 화면 기준으로 이용 제한을 동기화합니다.
(() => {
  const supportedDisplay = window.matchMedia("(min-width: 1024px) and (orientation: landscape)");
  const content = document.getElementById("service-content");
  const notice = document.getElementById("device-notice");
  let previousFocus;

  function closeServiceDialogs() {
    for (const dialog of content.querySelectorAll("dialog[open]")) dialog.close();
  }

  function syncDisplay() {
    const blocked = !supportedDisplay.matches;
    content.inert = blocked;
    if (blocked) {
      if (!notice.open) previousFocus = document.activeElement;
      closeServiceDialogs();
      if (!notice.open) notice.showModal();
    } else if (notice.open) {
      notice.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }

  // Esc나 뒤로 가기로 안내만 닫고 배경을 조작하지 못하도록 합니다.
  notice.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      notice.focus({ preventScroll: true });
    }
  });
  notice.addEventListener("cancel", (event) => event.preventDefault());
  notice.addEventListener("close", () => {
    if (!supportedDisplay.matches) syncDisplay();
  });
  // 비동기 처리로 열린 다른 모달도 제한 안내 앞에 나타나지 않게 합니다.
  new MutationObserver(() => {
    if (!supportedDisplay.matches) closeServiceDialogs();
  }).observe(content, { subtree: true, attributes: true, attributeFilter: ["open"] });
  supportedDisplay.addEventListener("change", syncDisplay);
  syncDisplay();
})();
