import fs from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { loadCatalog } from "./catalog.mjs";
import { renderList, renderDetail } from "../src/views.js";

// 編集するのは data/songs/楽曲名/song.json。distはここから再生成する。
const songs = loadCatalog();
const settings = JSON.parse(fs.readFileSync("data/settings.json", "utf8"));
const adminState = JSON.parse(fs.readFileSync("data/admin-state.json", "utf8"));
if (
  !Number.isSafeInteger(adminState.nextId) ||
  adminState.nextId <= Math.max(...songs.map((s) => s.id))
) {
  throw new Error(
    "data/admin-state.json の nextId を全楽曲のidより大きくしてください。",
  );
}
if (Date.parse(adminState.updatedAt) > Date.parse(settings.updatedAt))
  settings.updatedAt = adminState.updatedAt;
const rawBase = process.env.SITE_BASE_PATH || "";
if (rawBase && !/^\/[A-Za-z0-9_.-]+\/?$/.test(rawBase))
  throw new Error("SITE_BASE_PATHが不正です。");
const base = rawBase ? rawBase.replace(/\/$/, "") + "/" : "/";
const data = { ...settings, songs };
const template = fs
  .readFileSync("src/template.html", "utf8")
  .replace(/(href|src|action)="\//g, `$1="${base}`);
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
  "urls.js",
  "song-schema.js",
  "github-store.js",
  "admin.js",
  "admin.css",
]) {
  fs.copyFileSync(`src/${file}`, `dist/${file}`);
}
fs.writeFileSync("dist/songs.json", JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync(
  "dist/index.html",
  await page(renderList(data, new URLSearchParams(), base)),
);
for (const song of songs) {
  fs.mkdirSync(`dist/songs/${song.slug}`, { recursive: true });
  fs.writeFileSync(
    `dist/songs/${song.slug}/index.html`,
    await page(
      renderDetail(song, data, new URLSearchParams(), base),
      song.title + " | ガルパ楽曲ノート",
    ),
  );
}
fs.writeFileSync(
  "dist/404.html",
  await page(
    `<h1>ページが見つかりません</h1><a href="${base}">楽曲一覧へ戻る</a>`,
  ),
);
fs.mkdirSync("dist/admin", { recursive: true });
const adminHTML = fs
  .readFileSync("src/admin.html", "utf8")
  .replace(/(href|src|action)="\//g, `$1="${base}`);
fs.writeFileSync(
  "dist/admin/index.html",
  await format(adminHTML, { parser: "html" }),
);
const [owner = "", repo = ""] = (process.env.GITHUB_REPOSITORY || "").split(
  "/",
);
fs.writeFileSync(
  "dist/admin-config.json",
  JSON.stringify({ owner, repo, branch: "main" }, null, 2) + "\n",
);
fs.writeFileSync("dist/.nojekyll", "");
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
