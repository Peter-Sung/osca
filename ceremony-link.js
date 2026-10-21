// 이미 열린 발표 화면의 재생 위치를 유지하고 같은 탭을 다시 활성화합니다.
(() => {
  const link = document.getElementById("ceremony-link");
  let playerWindow = null;
  link.addEventListener("click", (event) => {
    // 수정 키로 새 탭/창을 요청한 경우 브라우저 기본 동작을 유지합니다.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!playerWindow || playerWindow.closed) {
      // 빈 URL로 기존의 이름 있는 탭을 찾으면 다시 탐색하지 않아 진행 상태가 유지됩니다.
      const opened = window.open("", link.target);
      if (!opened) return; // 팝업이 제한되면 href/target의 일반 링크 동작으로 이어집니다.
      try {
        const current = new URL(opened.location.href);
        const expected = new URL(link.href);
        if (current.origin !== expected.origin || current.pathname !== expected.pathname) opened.location.replace(expected.href);
      } catch (_) {
        // 탭이 다른 사이트로 이동했다면 발표 화면을 다시 엽니다.
        opened.location.href = link.href;
      }
      playerWindow = opened;
    }
    event.preventDefault();
    playerWindow.focus();
  });
})();
