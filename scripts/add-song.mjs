import fs from "node:fs";
import { loadCatalog } from "./catalog.mjs";
import { GARUPA_SONGS_PATH, GARUPA_STATE_PATH } from "../src/js/garupa-data.js";

const [title, extra] = process.argv.slice(2);
if (!title || extra) {
  console.error('使い方: node scripts/add-song.mjs "楽曲名"');
  process.exit(1);
}

const songs = loadCatalog();
const data = JSON.parse(fs.readFileSync(GARUPA_SONGS_PATH, "utf8"));
const state = JSON.parse(fs.readFileSync(GARUPA_STATE_PATH, "utf8"));
if (!Number.isSafeInteger(state.nextId) || state.nextId < 1)
  throw new Error("管理用の番号データが不正です。");
const song = JSON.parse(fs.readFileSync("templates/song.json", "utf8"));
song.id = Math.max(
  state.nextId,
  Math.max(0, ...songs.map((item) => item.id)) + 1,
);
song.title = title;
song.releaseOrder = song.id;

// ひな型のband・categoryを変更してから、同じグループで編集する。
let group = data.groups.find(
  (item) => item.band === song.band && item.category === song.category,
);
if (!group) {
  group = { band: song.band, category: song.category, songs: [] };
  data.groups.push(group);
}
const { band, category, ...entry } = song;
group.songs.push(entry);
fs.writeFileSync(GARUPA_SONGS_PATH, JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync(
  GARUPA_STATE_PATH,
  JSON.stringify(
    { nextId: song.id + 1, updatedAt: new Date().toISOString() },
    null,
    2,
  ) + "\n",
);
console.log(
  `追加しました: ${GARUPA_SONGS_PATH} のID ${song.id}\nバンド・種類・読み・配信日・難易度などを記入してからビルドしてください。`,
);
