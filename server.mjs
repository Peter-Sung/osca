// 공개 화면 파일만 제공하는 오스카 빌리지 로컬 미리보기 서버입니다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/vote-store.js", ["vote-store.js", "text/javascript; charset=utf-8"]],
  ...["OSCA_home", "O_house", "S_house", "C_house", "A_house",
    "O_desc_board_vote", "S_desc_board_vote", "C_desc_board_vote", "A_desc_board_vote"].map((name) =>
    [`/asset/${name}.png`, [`asset/${name}.png`, "image/png"]]),
]);

const server = createServer(async (request, response) => {
  const file = publicFiles.get(new URL(request.url, "http://localhost").pathname);
  if (!file || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const data = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { "Content-Type": file[1], "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    console.error("화면 파일을 읽지 못했습니다.", error.message);
    response.writeHead(500).end("Unable to load file");
  }
});

server.listen(5173, "127.0.0.1", () => {
  console.log("오스카 빌리지 미리보기: http://127.0.0.1:5173");
});
