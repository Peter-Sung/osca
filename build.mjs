// 공개 화면과 이미지만 Vercel 정적 배포 디렉터리에 복사합니다.
import { mkdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, basename } from "node:path";
import { ceremonyFiles } from "./ceremony-files.mjs";
const root = fileURLToPath(new URL("./", import.meta.url));
const output = fileURLToPath(new URL("./dist", import.meta.url));
if (dirname(output) !== root.replace(/[\\/]$/, "") || basename(output) !== "dist") throw new Error("잘못된 빌드 경로입니다.");
await rm(output, { recursive: true, force: true });
await mkdir(new URL("./dist/asset/", import.meta.url), { recursive: true });
const files = ["index.html", "styles.css", "app.js", "ceremony-link.js", "config.js", "vote-store.js", "admin.html", "admin.css", "admin.js", "display-guard.js",
  "asset/favicon-32.png", "asset/favicon-192.png",
  ...["O", "S", "C", "A"].map((house) => `asset/${house}_Intro_crop.png`),
  ...["OSCA_home", "O_house", "S_house", "C_house", "A_house", "O_desc_board_vote", "S_desc_board_vote", "C_desc_board_vote", "A_desc_board_vote"].map((name) => `asset/${name}.png`),
  ...ceremonyFiles];
await Promise.all(files.map(async (file) => {
  const destination = new URL(`./dist/${file}`, import.meta.url);
  await mkdir(new URL("./", destination), { recursive: true });
  await copyFile(new URL(file, import.meta.url), destination);
}));
console.log(`공개 파일 ${files.length}개를 dist에 생성했습니다.`);
