import fs from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { loadGameCatalog } from "./catalog.mjs";
import { GAMES, siteSettings } from "../src/js/site-config.js";
import { GARUPA_LEGACY_PATH } from "../src/js/garupa-data.js";
import {
  absoluteURL,
  siteURL,
  gamePath,
  songListPath,
  songPath,
} from "../src/js/urls.js";
import { renderList, renderDetail } from "../src/js/views.js";
import {
  escapeHTML,
  safeJSON,
  detailTitle,
  detailDescription,
  breadcrumbMarkup,
  breadcrumbJSON,
} from "../src/js/seo.js";

const settings = siteSettings(process.env);
const output = path.resolve(process.env.SITE_OUTPUT_DIR || "dist");
const repositoryRoot = process.cwd();
const distRoot = path.resolve("dist");
const cacheRoot = path.resolve(".cache");
if (!(output === distRoot || output.startsWith(cacheRoot + path.sep)))
  throw new Error("SITE_OUTPUT_DIRはdistまたは.cache内にしてください。");
if (output === repositoryRoot || output === path.parse(output).root)
  throw new Error("不正な出力先です。");
if (
  fs.existsSync(output) &&
  (fs.lstatSync(output).isSymbolicLink() ||
    !fs.realpathSync(output).startsWith(repositoryRoot + path.sep))
)
  throw new Error("出力先はリポジトリ内の通常ディレクトリにしてください。");
const games = Object.values(GAMES);
const catalogs = Object.fromEntries(
  games.map((game) => [game.id, loadGameCatalog(game)]),
);
const garupaSongs = catalogs.garupa;
const siteData = JSON.parse(fs.readFileSync("data/settings.json", "utf8"));
const adminStates = Object.fromEntries(
  games.map((game) => [
    game.id,
    JSON.parse(fs.readFileSync(game.stateFile, "utf8")),
  ]),
);
for (const game of games) {
  const state = adminStates[game.id];
  if (
    !Number.isSafeInteger(state.nextId) ||
    state.nextId <= Math.max(0, ...catalogs[game.id].map((song) => song.id))
  )
    throw new Error(
      `${game.stateFile} の nextId を全楽曲のidより大きくしてください。`,
    );
}
if (Date.parse(adminStates.garupa.updatedAt) > Date.parse(siteData.updatedAt))
  siteData.updatedAt = adminStates.garupa.updatedAt;
const catalogInfo = Object.fromEntries(
  games.map((game) => [
    game.id,
    {
      ...siteData,
      ...(game.id === "ournotes"
        ? { updatedAt: adminStates.ournotes.updatedAt }
        : {}),
      songs: catalogs[game.id],
    },
  ]),
);

const legacy = JSON.parse(fs.readFileSync(GARUPA_LEGACY_PATH, "utf8"));
const knownIds = new Set(garupaSongs.map((song) => song.stableSongId));
const seenLegacyPaths = new Set();
const redirects = [];
for (const entry of legacy) {
  if (
    entry.gameId !== "garupa" ||
    !knownIds.has(entry.stableSongId) ||
    !Array.isArray(entry.slugs) ||
    !entry.slugs.length
  )
    throw new Error("旧URL対応表に不正な楽曲IDまたはパスがあります。");
  for (const slug of entry.slugs) {
    if (
      typeof slug !== "string" ||
      !slug ||
      slug.includes("/") ||
      slug === "." ||
      slug === ".."
    )
      throw new Error("旧URL対応表の曲名パスが不正です。");
    const source = `/songs/${encodeURIComponent(slug)}/`;
    if (seenLegacyPaths.has(source.toLowerCase()))
      throw new Error(`旧URLが重複しています: ${source}`);
    seenLegacyPaths.add(source.toLowerCase());
    redirects.push({
      from: source,
      to: `/${songPath(GAMES.garupa, entry.stableSongId)}`,
      stableSongId: entry.stableSongId,
      slug,
    });
  }
}

const template = fs.readFileSync("src/pages/template.html", "utf8");
const write = (relative, content) => {
  const file = path.resolve(output, relative);
  if (!file.startsWith(output + path.sep))
    throw new Error(`不正な生成パス: ${relative}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const url = (relative) => absoluteURL(relative, settings);
const local = (relative) => siteURL(relative, settings.basePath);
const xmlEscape = (value) => escapeHTML(value).replace(/&#39;/g, "&apos;");
const sitemap = [];
const home = { name: "サイトトップ", path: "" };
const gameCrumb = (game) => ({ name: game.shortName, path: gamePath(game) });
const listCrumb = (game) => ({ name: "楽曲一覧", path: songListPath(game) });

async function page({
  file,
  pagePath,
  title,
  description,
  content,
  breadcrumbs = [home],
  indexable = true,
  scripts = [],
  jsonld = [],
}) {
  const searchGame =
    games.find((game) => pagePath.startsWith(`${game.slug}/`)) || GAMES.garupa;
  const canonical = url(pagePath);
  const image = url(settings.image);
  const head = [
    `<title>${escapeHTML(title)}</title>`,
    `<meta name="description" content="${escapeHTML(description)}" />`,
    `<link rel="canonical" href="${escapeHTML(canonical)}" />`,
    ...(!indexable ? ['<meta name="robots" content="noindex,follow" />'] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHTML(title)}" />`,
    `<meta property="og:description" content="${escapeHTML(description)}" />`,
    `<meta property="og:url" content="${escapeHTML(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHTML(settings.name)}" />`,
    `<meta property="og:image" content="${escapeHTML(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHTML(settings.name)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHTML(title)}" />`,
    `<meta name="twitter:description" content="${escapeHTML(description)}" />`,
    `<meta name="twitter:image" content="${escapeHTML(image)}" />`,
    `<link rel="icon" href="${escapeHTML(local(settings.favicon))}" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${escapeHTML(local(settings.appleTouchIcon))}" sizes="180x180" />`,
    `<link rel="stylesheet" href="${escapeHTML(local("style.css"))}" />`,
    `<link rel="stylesheet" href="${escapeHTML(local("mobile.css"))}" />`,
    ...scripts.map(
      (script) =>
        `<script ${script === "query-index.js" ? `data-index-page="${pagePath ? "list" : "root"}" ` : 'type="module" '}src="${escapeHTML(local(script))}"></script>`,
    ),
    ...[breadcrumbJSON(breadcrumbs, settings), ...jsonld]
      .filter(Boolean)
      .map(
        (value) =>
          `<script type="application/ld+json">${safeJSON(value)}</script>`,
      ),
  ].join("\n");
  const body =
    breadcrumbMarkup(breadcrumbs, settings) +
    `<div id="app-content">${content}</div>`;
  const replacements = {
    "<!--HEAD-->": head,
    "<!--CONTENT-->": body,
    "<!--HOME_URL-->": local(""),
    "<!--GARUPA_URL-->": local(gamePath(GAMES.garupa)),
    "<!--OURNOTES_URL-->": local(gamePath(GAMES.ournotes)),
    "<!--ABOUT_URL-->": local("about/"),
    "<!--SOURCES_URL-->": local("sources/"),
    "<!--PRIVACY_URL-->": local("privacy/"),
    "<!--SEARCH_ACTION-->": local(songListPath(searchGame)),
    "<!--SEARCH_LABEL-->": `${searchGame.shortName}の楽曲名・原曲の作品名で検索`,
    "<!--SEARCH_PLACEHOLDER-->": `${searchGame.shortName}の楽曲名・作品名で検索`,
    "<!--SITE_NAME-->": escapeHTML(settings.name),
  };
  let html = template;
  for (const [needle, replacement] of Object.entries(replacements))
    html = html.replaceAll(needle, replacement);
  write(file, await format(html, { parser: "html", printWidth: 100 }));
  if (indexable) sitemap.push(canonical);
}

// distと検証用.cache出力のみを再生成する。旧ページや削除曲の残骸を残さない。
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const [directory, names] of [
  [
    "js",
    [
      "app.js",
      "domain.js",
      "views.js",
      "urls.js",
      "site-config.js",
      "seo.js",
      "song-schema.js",
      "garupa-data.js",
      "github-store.js",
      "admin.js",
      "query-index.js",
      "legacy-redirect.js",
    ],
  ],
  ["styles", ["style.css", "mobile.css", "admin.css"]],
  ["images", ["favicon.svg", "og-default.png", "apple-touch-icon.png"]],
  ["static", ["_headers"]],
])
  for (const name of names)
    fs.copyFileSync(`src/${directory}/${name}`, path.join(output, name));

write(GAMES.garupa.catalog, JSON.stringify(catalogInfo.garupa, null, 2) + "\n");
write(
  GAMES.ournotes.catalog,
  JSON.stringify(catalogInfo.ournotes, null, 2) + "\n",
);
// 既存の公開カタログを参照する古いブックマークと管理画面の移行期間用。
write(
  "songs.json",
  JSON.stringify({ ...siteData, songs: garupaSongs }, null, 2) + "\n",
);

await page({
  file: "index.html",
  pagePath: "",
  title: `${settings.name} | バンドリ楽曲データベース`,
  description:
    "ガルパとアワーノーツの楽曲データを探せる非公式データベース。ゲームごとの楽曲一覧と情報を公開しています。",
  content: `<section class="intro"><div><p class="eyebrow">BANG DREAM! · SONG DATABASE</p><h1>${escapeHTML(settings.name)}</h1><p>バンドリの楽曲情報をゲームごとに探せます。</p></div></section><div class="game-cards">${games.map((game) => `<section class="panel"><h2><a href="${local(gamePath(game))}">${escapeHTML(game.shortName)}</a></h2><p>${escapeHTML(game.name)}</p><p>${catalogs[game.id].length}曲を掲載しています。</p><a href="${local(songListPath(game))}">楽曲一覧を見る</a></section>`).join("")}</div>`,
  scripts: ["query-index.js", "app.js"],
  jsonld: [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: settings.name,
      url: url(""),
      ...(settings.alternateName
        ? { alternateName: settings.alternateName }
        : {}),
    },
  ],
});

for (const game of games) {
  const songs = catalogs[game.id];
  await page({
    file: `${game.slug}/index.html`,
    pagePath: gamePath(game),
    title: `${game.seoName} 楽曲データベース | ${settings.name}`,
    description: `${game.name}の楽曲データベース。${songs.length}曲の曲名とバンド${game.fields.includes("level") ? "、譜面難易度・ノーツ数など" : "、種類・ゲーム内実装日"}を掲載しています。`,
    breadcrumbs: [home, gameCrumb(game)],
    content: `<section class="intro"><div><p class="eyebrow">${escapeHTML(game.name)}</p><h1>${escapeHTML(game.shortName)} 楽曲データベース</h1><p>${songs.length}曲の情報を掲載しています。</p></div></section><div class="panel"><h2>楽曲を探す</h2><p>曲名・バンド・難易度から探せます。</p><a href="${local(songListPath(game))}">楽曲一覧へ</a></div><div class="panel"><h2>楽曲を追加・修正</h2><a href="${local(`admin/${game.id === "ournotes" ? "?game=ournotes" : ""}`)}">${escapeHTML(game.shortName)}の管理ページへ</a></div>`,
  });
  await page({
    file: `${game.slug}/songs/index.html`,
    pagePath: songListPath(game),
    title: `${game.seoName} 楽曲一覧${game.fields.includes("bpm") ? "・BPM・難易度・ノーツ数" : ""} | ${settings.name}`,
    description: `${game.name}の${songs.length}曲を曲名・バンド${game.fields.includes("level") ? "・難易度" : "・種類"}などで検索できます。`,
    breadcrumbs: [home, gameCrumb(game), listCrumb(game)],
    content: renderList(
      catalogInfo[game.id],
      new URLSearchParams(),
      settings.basePath,
      game,
    ),
    scripts: ["query-index.js", "app.js"],
  });
  for (const song of songs) {
    if (!/^[A-Za-z0-9_-]+$/.test(song.stableSongId))
      throw new Error(`${game.slug}のstableSongIdが不正です。`);
    if (game.id === "garupa" && !/^[1-9][0-9]*$/.test(song.stableSongId))
      throw new Error("ガルパのstableSongIdは正の整数にしてください。");
    await page({
      file: `${game.slug}/songs/${song.stableSongId}/index.html`,
      pagePath: songPath(game, song.stableSongId),
      title: detailTitle(song, game, songs),
      description: detailDescription(song, game),
      breadcrumbs: [
        home,
        gameCrumb(game),
        listCrumb(game),
        { name: song.title, path: songPath(game, song.stableSongId) },
      ],
      content: renderDetail(
        song,
        catalogInfo[game.id],
        new URLSearchParams(),
        settings.basePath,
        game,
      ),
      scripts: ["app.js"],
    });
  }
}

const informationPages = [
  {
    slug: "about",
    name: "サイトについて",
    description: `${settings.name}の目的と運営方針。バンドリシリーズの楽曲データをゲームごとに整理する非公式サイトです。`,
    content: `<h1>サイトについて</h1><section class="panel"><h2>このサイトについて</h2><p>${escapeHTML(settings.name)}は、バンドリシリーズの楽曲情報をゲームごとに調べられる非公式ファンデータベースです。ガルパとアワーノーツの確認済み楽曲情報を掲載しています。</p><p>ゲームや楽曲の権利は各権利者に帰属します。</p></section>`,
  },
  {
    slug: "sources",
    name: "データ出典・更新方針",
    description: `${settings.name}の楽曲情報の出典と更新方法、確認中の項目の扱いを説明します。`,
    content: `<h1>データ出典・更新方針</h1><section class="panel"><h2>データの管理</h2><p>ガルパの楽曲情報はゲーム内情報と公開資料を参照し、手動で編集しています。確認できない項目は未確認として表示し、推測した数値で埋めません。</p><h2>アワーノーツ</h2><p>リリース時の曲名・演奏バンド・オリジナル／カバーの区分は<a href="https://www.fromtyo.jp/news/20260915">開発元の初期実装楽曲発表</a>を参照しました。2026年9月25日以降の追加予定曲は、実装を確認するまで掲載しません。BPM・譜面難易度・ノーツ数など未確認の項目は空欄として扱います。</p><h2>BPMと演奏時間</h2><p>ガルパ既存曲のBPMとゲーム内演奏時間は<a href="https://bestdori.com/api/songs/all.7.json">Bestdori!の公開データ</a>を参照して調査しました。基本BPMはEXPERT譜面で継続時間が最も長い値、演奏時間はゲーム版の長さを秒単位へ切り捨てた値です。元データとの対応と詳細はリポジトリ内の調査記録に残しています。</p><p>ページのデータ更新日は個別の楽曲が最後に変更された日を示すものではありません。</p></section>`,
  },
  {
    slug: "privacy",
    name: "プライバシーポリシー",
    description: `${settings.name}の閲覧・管理ページにおけるデータの取り扱いを説明します。`,
    content: `<h1>プライバシーポリシー</h1><section class="panel"><h2>閲覧と入力データ</h2><p>現在、広告やアクセス解析は設置していません。検索・絞り込み条件はURLのクエリに含まれます。</p><p>管理ページは入力途中の内容や接続先設定をブラウザーのローカルストレージに保存します。GitHubへの保存時は入力した認証情報を使用してGitHub APIと通信します。アクセストークンはブラウザーの保存領域には記録しません。</p><p>外部サイトへのリンク先では、そのサイトの取り扱い方針が適用されます。</p></section>`,
  },
];
for (const info of informationPages)
  await page({
    file: `${info.slug}/index.html`,
    pagePath: `${info.slug}/`,
    title: `${info.name} | ${settings.name}`,
    description: info.description,
    breadcrumbs: [home, { name: info.name, path: `${info.slug}/` }],
    content: info.content,
  });

await page({
  file: "search/index.html",
  pagePath: "search/",
  title: `ゲーム横断検索 | ${settings.name}`,
  description: "ゲーム横断検索の準備状況とゲーム別の楽曲検索への入口。",
  breadcrumbs: [home, { name: "ゲーム横断検索", path: "search/" }],
  indexable: false,
  content: `<h1>ゲーム横断検索</h1><div class="panel"><h2>準備中</h2><p>現在はゲームごとの一覧から探してください。</p>${games.map((game) => `<p><a href="${local(songListPath(game))}">${escapeHTML(game.shortName)}の楽曲一覧へ</a></p>`).join("")}</div>`,
});
await page({
  file: "404.html",
  pagePath: "404.html",
  title: `ページが見つかりません | ${settings.name}`,
  description: "指定されたページが見つかりません。",
  indexable: false,
  content: `<h1>ページが見つかりません</h1><p>URLを確認するか、<a href="${local("")}">サイトトップ</a>から探してください。</p>`,
});

for (const redirect of redirects) {
  const target = url(redirect.to.slice(1));
  const link = local(redirect.to.slice(1));
  write(
    `songs/${redirect.slug}/index.html`,
    await format(
      `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${escapeHTML(target)}"><title>ページが移動しました | ${escapeHTML(settings.name)}</title><script type="module" src="${local("legacy-redirect.js")}"></script></head><body><main><h1>楽曲ページが移動しました</h1><p><a id="new-song-url" href="${escapeHTML(link)}">新しい楽曲ページへ</a></p></main></body></html>`,
      { parser: "html" },
    ),
  );
}
write(
  "legacy-redirects.json",
  JSON.stringify(
    redirects.map(({ from, to }) => ({ from, to })),
    null,
    2,
  ) + "\n",
);
write(
  "legacy-redirects.csv",
  "from,to\n" +
    redirects
      .map(
        ({ from, to }) =>
          `"${from.replaceAll('"', '""')}","${to.replaceAll('"', '""')}"`,
      )
      .join("\n") +
    "\n",
);
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((entry) => `  <url><loc>${xmlEscape(entry)}</loc></url>`).join("\n")}\n</urlset>\n`,
);
write(
  "robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${url("sitemap.xml")}\n`,
);

const adminHTML = fs
  .readFileSync("src/pages/admin.html", "utf8")
  .replace(/(href|src|action)="\//g, `$1="${settings.basePath}`)
  .replaceAll("<!--SITE_NAME-->", escapeHTML(settings.name));
write("admin/index.html", await format(adminHTML, { parser: "html" }));
const [owner = "", repo = ""] = (process.env.GITHUB_REPOSITORY || "").split(
  "/",
);
write(
  "admin-config.json",
  JSON.stringify({ owner, repo, branch: "main" }, null, 2) + "\n",
);
write(".nojekyll", "");
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/quality-report.json",
  JSON.stringify(
    {
      songs: garupaSongs.length,
      difficulties: garupaSongs.reduce(
        (n, song) => n + song.difficulties.filter(Boolean).length,
        0,
      ),
      missingArtists: garupaSongs
        .filter((song) => song.type !== "normal" && !song.artist)
        .map((song) => song.title),
      missingComposers: garupaSongs
        .filter((song) => !song.composer)
        .map((song) => song.title),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${games.map((game) => `${game.shortName}${catalogs[game.id].length}曲`).join("・")}の正規ページ、${redirects.length}件の旧URL互換ページを生成しました。`,
);
