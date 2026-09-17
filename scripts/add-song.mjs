import fs from "node:fs";
import { folderName, loadCatalog } from "./catalog.mjs";

const [title, customFolder] = process.argv.slice(2);
if (!title) {
  console.error(
    '使い方: node scripts/add-song.mjs "楽曲名" [ローマ字フォルダー名]',
  );
  process.exit(1);
}
const slug = folderName(customFolder || title);
if (/^\d+$/.test(slug))
  throw new Error("数字だけでなく、楽曲名またはローマ字を指定してください。");
const songs = loadCatalog();
if (songs.some((song) => song.slug.toLowerCase() === slug.toLowerCase()))
  throw new Error(
    "同名フォルダーがあります。別バンドや別バージョンは第2引数で区別してください。",
  );
const song = JSON.parse(fs.readFileSync("templates/song.json", "utf8"));
song.id = Math.max(0, ...songs.map((song) => song.id)) + 1;
song.title = title;
song.releaseOrder = song.id;
fs.mkdirSync(`data/songs/${slug}`, { recursive: true });
fs.writeFileSync(
  `data/songs/${slug}/song.json`,
  JSON.stringify(song, null, 2) + "\n",
);
console.log(
  `作成しました: data/songs/${slug}/song.json\n読み・バンド・配信日・難易度などを記入してからビルドしてください。`,
);
