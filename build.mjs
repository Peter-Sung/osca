// 공개 화면과 이미지만 Vercel 정적 배포 디렉터리에 복사합니다.
import { mkdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, basename } from "node:path";
const root = fileURLToPath(new URL("./", import.meta.url));
const output = fileURLToPath(new URL("./dist", import.meta.url));
if (dirname(output) !== root.replace(/[\\/]$/, "") || basename(output) !== "dist") throw new Error("잘못된 빌드 경로입니다.");
await rm(output, { recursive: true, force: true });
await mkdir(new URL("./dist/asset/", import.meta.url), { recursive: true });
const files = ["index.html", "styles.css", "app.js", "config.js", "vote-store.js", "admin.html", "admin.css", "admin.js",
  ...["OSCA_home", "O_house", "S_house", "C_house", "A_house", "O_desc_board_vote", "S_desc_board_vote", "C_desc_board_vote", "A_desc_board_vote"].map((name) => `asset/${name}.png`)];
await Promise.all(files.map((file) => copyFile(new URL(file, import.meta.url), new URL(`./dist/${file}`, import.meta.url))));
console.log(`공개 파일 ${files.length}개를 dist에 생성했습니다.`);
