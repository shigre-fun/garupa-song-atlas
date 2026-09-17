import fs from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { loadCatalog } from "./catalog.mjs";
import { renderList, renderDetail } from "../src/views.js";

// 編集するのは data/songs/楽曲名/song.json。distはここから再生成する。
const songs = loadCatalog();
const settings = JSON.parse(fs.readFileSync("data/settings.json", "utf8"));
const data = { ...settings, songs };
const template = fs.readFileSync("src/template.html", "utf8");
const escapeHTML = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

async function page(content, title = "ガルパ楽曲ノート") {
  const html = template
    .replace(
      "<title>ガルパ楽曲ノート</title>",
      `<title>${escapeHTML(title)}</title>`,
    )
    .replace(
      /<main id="app">[\s\S]*?<\/main>/,
      () => `<main id="app">${content}</main>`,
    );
  return format(html, { parser: "html", printWidth: 100 });
}

fs.mkdirSync("dist/songs", { recursive: true });
const root = path.resolve("dist/songs");
const active = new Set(songs.map((song) => song.slug));
// このサイトが生成した曲ページだけを対象に、旧フォルダーを取り除く。
for (const name of fs.readdirSync(root)) {
  const target = path.resolve(root, name);
  if (
    !active.has(name) &&
    target.startsWith(root + path.sep) &&
    fs.existsSync(path.join(target, "index.html"))
  ) {
    fs.rmSync(target, { recursive: true });
  }
}
for (const file of [
  "app.js",
  "domain.js",
  "views.js",
  "style.css",
  "mobile.css",
  "favicon.svg",
  "_headers",
  "robots.txt",
]) {
  fs.copyFileSync(`src/${file}`, `dist/${file}`);
}
fs.writeFileSync("dist/songs.json", JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync("dist/index.html", await page(renderList(data)));
for (const song of songs) {
  fs.mkdirSync(`dist/songs/${song.slug}`, { recursive: true });
  fs.writeFileSync(
    `dist/songs/${song.slug}/index.html`,
    await page(renderDetail(song, data), song.title + " | ガルパ楽曲ノート"),
  );
}
fs.writeFileSync(
  "dist/404.html",
  await page('<h1>ページが見つかりません</h1><a href="/">楽曲一覧へ戻る</a>'),
);
fs.writeFileSync(
  "data/quality-report.json",
  JSON.stringify(
    {
      songs: songs.length,
      difficulties: songs.reduce(
        (n, s) => n + s.difficulties.filter(Boolean).length,
        0,
      ),
      missingArtists: songs
        .filter((s) => s.type !== "normal" && !s.artist)
        .map((s) => s.title),
      missingComposers: songs.filter((s) => !s.composer).map((s) => s.title),
    },
    null,
    2,
  ) + "\n",
);
console.log(`${songs.length}曲のページを生成しました。`);
