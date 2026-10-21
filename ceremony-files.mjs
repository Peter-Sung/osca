// 웹에 공개할 재생 화면 파일만 명시합니다. 원본 ZIP·도구·QA 파일은 제외합니다.
export const ceremonyFiles = [
  "index.html", "ceremony.css", "config.js", "votes.js", "engine.js", "render.js", "player.js", "favicon.png",
  "fonts/A2Z-4Regular.woff2", "fonts/A2Z-5Medium.woff2", "fonts/A2Z-6SemiBold.woff2",
  "fonts/A2Z-7Bold.woff2", "fonts/A2Z-9Black.woff2", "fonts/OFL.txt", "fonts/SOURCE.txt",
].map((file) => `ceremony/${file}`);

export const ceremonyContentType = (file) => ({
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  png: "image/png", woff2: "font/woff2", txt: "text/plain; charset=utf-8",
})[file.split(".").pop()];
