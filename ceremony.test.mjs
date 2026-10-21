import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createPreviewServer } from "./server.mjs";
import { ceremonyFiles, ceremonyContentType } from "./ceremony-files.mjs";

const source = await readFile(new URL("./ceremony-link.js", import.meta.url), "utf8");
function launcher(opened) {
  const calls = { open: 0, focus: 0, replace: [], prevented: 0 };
  let click;
  const link = {
    href: "https://osca.example/ceremony/index.html", target: "OSCA_CEREMONY_MAIN",
    addEventListener: (_name, fn) => { click = fn; },
  };
  const popup = opened === false ? null : {
    closed: false,
    location: { href: opened || "about:blank", replace: url => { calls.replace.push(url); popup.location.href = url; } },
    focus: () => calls.focus++,
  };
  runInNewContext(source, { URL, document: { getElementById: () => link }, window: { open: (url, target) => {
    calls.open++; assert.equal(url, ""); assert.equal(target, "OSCA_CEREMONY_MAIN"); return popup;
  } } });
  const event = options => ({ button: 0, preventDefault: () => calls.prevented++, ...options });
  return { calls, popup, click: options => click(event(options)) };
}

test("홈 링크는 새 발표 탭을 열고, 다시 눌러도 재생 화면을 새로 불러오지 않는다", () => {
  const { calls, click, popup } = launcher();
  click(); click();
  assert.equal(calls.open, 1); assert.equal(calls.focus, 2); assert.equal(calls.replace.length, 1);
  assert.equal(calls.replace[0], "https://osca.example/ceremony/index.html");
  popup.closed = true; click();
  assert.equal(calls.open, 2);
});
test("홈을 새로고침해도 이름 있는 기존 발표 탭의 장면을 유지한다", () => {
  const { calls, click } = launcher("https://osca.example/ceremony/index.html?session=existing");
  click(); assert.equal(calls.focus, 1); assert.deepEqual(calls.replace, []);
});
test("새 탭 수정 키와 팝업 차단 시 일반 링크 동작을 유지한다", () => {
  const modified = launcher();
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) modified.click(options);
  assert.equal(modified.calls.open, 0); assert.equal(modified.calls.prevented, 0);
  const blocked = launcher(false); blocked.click(); assert.equal(blocked.calls.prevented, 0);
});
test("로컬 서버는 재생 화면·폰트만 공개하며 설정과 개발 파일을 구분한다", async () => {
  const server = createPreviewServer({ adminProxy: () => { throw new Error("unexpected admin access"); }, config: { devOnly: true } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base); assert.equal(home.status, 200);
    assert.match(await home.text(), /id="ceremony-link" href="ceremony\/index.html" target="OSCA_CEREMONY_MAIN"/);
    for (const file of ["ceremony-link.js", ...ceremonyFiles]) {
      const response = await fetch(`${base}/${file}`);
      assert.equal(response.status, 200, file);
      if (file.startsWith("ceremony/")) assert.equal(response.headers.get("content-type"), ceremonyContentType(file));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(file, import.meta.url)), file);
    }
    assert.equal((await fetch(`${base}/ceremony/`)).status, 200);
    assert.match(await (await fetch(`${base}/config.js`)).text(), /devOnly/);
    assert.match(await (await fetch(`${base}/ceremony/config.js`)).text(), /event: 'OSCA'/);
    for (const path of ["ceremony/tools/import-votes.py", "ceremony/tools/a2z-original.zip", "ceremony/qa/race-preview.png", "ceremony-files.mjs", "ceremony/tools/verify.cjs"]) assert.equal((await fetch(`${base}/${path}`)).status, 404, path);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
