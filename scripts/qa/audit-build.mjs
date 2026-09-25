import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SITE_ORIGIN } from "../../src/js/site-config.js";

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const tag = (html, expression) =>
  [...html.matchAll(expression)].map((match) => match[1]);
const attr = (html, name, value, field = "content") => {
  const opening = [...html.matchAll(/<(?:meta|link)\b[^>]*>/gs)].map(
    ([element]) => element,
  );
  const found = opening.find((element) =>
    element.includes(`${name}="${value}"`),
  );
  return found?.match(new RegExp(`${field}="([^"]*)"`))?.[1] || null;
};

export function auditBuild({ directory = "dist", origin, basePath = "/" }) {
  const root = path.resolve(directory);
  const failures = [];
  const fail = (message) => failures.push(message);
  const expectedOrigin = origin + basePath;
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decode(match[1]),
  );
  const sitemapSet = new Set(urls);
  if (sitemapSet.size !== urls.length) fail("sitemapのURLが重複しています。");
  if (
    urls.some(
      (url) =>
        url.includes("?") ||
        (/\/(songs|admin|search)\/(?:[^/]+)?$/.test(url) &&
          url.includes("/admin/")),
    )
  )
    fail("sitemapにクエリまたは管理URLが混入しています。");
  if (/<lastmod>/.test(sitemap))
    fail("sitemapに信頼できないlastmodがあります。");
  const titles = new Map();
  let details = 0;
  const detailCounts = { garupa: 0, ournotes: 0 };

  const localFile = (pathname) => {
    const decoded = decodeURIComponent(pathname);
    if (!decoded.startsWith(basePath)) return null;
    const relative = decoded.slice(basePath.length);
    const target = path.resolve(
      root,
      relative,
      decoded.endsWith("/") || !path.extname(relative) ? "index.html" : "",
    );
    if (target !== root && !target.startsWith(root + path.sep)) return null;
    return target;
  };

  for (const canonical of urls) {
    if (!canonical.startsWith(expectedOrigin) || new URL(canonical).search) {
      fail(`sitemapの正規URLが不正: ${canonical}`);
      continue;
    }
    const file = localFile(new URL(canonical).pathname);
    if (!file || !fs.existsSync(file)) {
      fail(`正規ページが見つかりません: ${canonical}`);
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const title = tag(html, /<title>([^<]+)<\/title>/g)[0];
    if (!title) fail(`titleがありません: ${canonical}`);
    else {
      const prior = titles.get(title);
      if (prior) fail(`titleの重複: ${canonical} と ${prior}`);
      titles.set(title, canonical);
    }
    if (!attr(html, "name", "description"))
      fail(`descriptionがありません: ${canonical}`);
    if (attr(html, "rel", "canonical", "href") !== canonical)
      fail(`canonical不一致: ${canonical}`);
    if (tag(html, /<h1\b[^>]*>/g).length !== 1)
      fail(`h1が1個ではありません: ${canonical}`);
    if (attr(html, "property", "og:url") !== canonical)
      fail(`og:url不一致: ${canonical}`);
    for (const property of [
      "og:type",
      "og:title",
      "og:description",
      "og:site_name",
      "og:image",
    ])
      if (!attr(html, "property", property))
        fail(`${property}がありません: ${canonical}`);
    for (const name of [
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ])
      if (!attr(html, "name", name)) fail(`${name}がありません: ${canonical}`);
    if (
      !attr(html, "rel", "icon", "href") ||
      !attr(html, "rel", "apple-touch-icon", "href")
    )
      fail(`アイコンがありません: ${canonical}`);
    const detailGame = new URL(canonical).pathname.match(
      /\/(garupa|ournotes)\/songs\/[0-9]+\/$/,
    )?.[1];
    if (detailGame) {
      details++;
      detailCounts[detailGame]++;
      for (const text of ["楽曲情報", "パンくずリスト", "<h1"])
        if (!html.includes(text)) fail(`詳細情報が不足: ${canonical} ${text}`);
      if (detailGame === "garupa") {
        for (const text of ["難易度・ノーツ数", "<table"])
          if (!html.includes(text))
            fail(`詳細情報が不足: ${canonical} ${text}`);
      } else if (
        !html.includes("基本BPM") ||
        !html.includes("<h2>難易度・ノーツ数</h2>") ||
        html.includes("収録曲の公式発表を見る") ||
        html.includes('class="diff-4">SPECIAL</th>')
      )
        fail(`アワーノーツ詳細の欄が不正です: ${canonical}`);
    }
    if (
      canonical !== expectedOrigin &&
      !html.includes('"@type": "BreadcrumbList"')
    )
      fail(`BreadcrumbListがありません: ${canonical}`);
    if (canonical === expectedOrigin && !html.includes('"@type": "WebSite"'))
      fail("トップのWebSiteがありません。");
    for (const json of tag(
      html,
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    )) {
      try {
        JSON.parse(json);
      } catch {
        fail(`JSON-LDが不正: ${canonical}`);
      }
    }
    for (const reference of tag(html, /\b(?:href|src|action)="([^"]+)"/g)) {
      const link = new URL(decode(reference), canonical);
      if (link.origin !== origin) continue;
      const target = localFile(link.pathname);
      if (!target || !fs.existsSync(target))
        fail(`内部リンク切れ: ${canonical} -> ${reference}`);
    }
  }
  for (const gameId of Object.keys(detailCounts)) {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(root, gameId, "songs.json"), "utf8"),
    );
    if (detailCounts[gameId] !== catalog.songs.length)
      fail(
        `${gameId}の詳細ページ件数: ${detailCounts[gameId]} / ${catalog.songs.length}`,
      );
    for (const song of catalog.songs)
      if (
        !sitemapSet.has(
          `${expectedOrigin}${gameId}/songs/${song.stableSongId}/`,
        )
      )
        fail(`楽曲がsitemapにありません: ${gameId}/${song.stableSongId}`);
  }
  const required = [
    "",
    "garupa/songs/",
    "ournotes/songs/",
    "about/",
    "sources/",
    "privacy/",
  ];
  for (const relative of required)
    if (!sitemapSet.has(expectedOrigin + relative))
      fail(`sitemapに必要なページがありません: ${relative}`);
  for (const relative of ["garupa/", "ournotes/", "admin/"])
    if (sitemapSet.has(expectedOrigin + relative))
      fail(`削除対象がsitemapに残っています: ${relative}`);
  for (const relative of [
    "garupa/index.html",
    "ournotes/index.html",
    "admin/index.html",
    "admin.js",
    "admin.css",
    "admin-config.json",
    "github-store.js",
  ])
    if (fs.existsSync(path.join(root, relative)))
      fail(`削除対象が公開物に残っています: ${relative}`);
  if (
    sitemapSet.has(expectedOrigin + "search/") ||
    sitemapSet.has(expectedOrigin + "admin/")
  )
    fail("sitemapに非対象ページがあります。");
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  if (
    !robots.includes(`Sitemap: ${expectedOrigin}sitemap.xml`) ||
    /Disallow:/.test(robots)
  )
    fail("robots.txtが不正です。");
  const redirects = JSON.parse(
    fs.readFileSync(path.join(root, "legacy-redirects.json"), "utf8"),
  );
  for (const { from, to } of redirects) {
    const file = localFile(new URL(origin + basePath + from.slice(1)).pathname);
    if (!file || !fs.existsSync(file)) fail(`旧URLページがありません: ${from}`);
    else {
      const html = fs.readFileSync(file, "utf8");
      if (!html.includes('content="noindex,follow"'))
        fail(`旧URLにnoindexがありません: ${from}`);
      if (
        attr(html, "rel", "canonical", "href") !==
        expectedOrigin + to.slice(1)
      )
        fail(`旧URLのcanonicalが不正: ${from}`);
      if (!html.includes(`href="${basePath}${to.slice(1)}"`))
        fail(`旧URLの通常リンクが不正: ${from}`);
    }
    if (!sitemapSet.has(expectedOrigin + to.slice(1)))
      fail(`旧URLの行き先がsitemapにありません: ${to}`);
  }
  for (const relative of ["search/index.html", "404.html"]) {
    const html = fs.readFileSync(path.join(root, relative), "utf8");
    if (!/name="robots"\s+content="noindex(?:,follow|,nofollow)?"/.test(html))
      fail(`非対象ページにnoindexがありません: ${relative}`);
    for (const reference of tag(html, /\b(?:href|src|action)="([^"]+)"/g)) {
      const link = new URL(decode(reference), expectedOrigin + relative);
      if (link.origin !== origin) continue;
      const target = localFile(link.pathname);
      if (!target || !fs.existsSync(target))
        fail(`内部リンク切れ: ${relative} -> ${reference}`);
    }
  }
  if (failures.length)
    throw new Error(
      `${failures.length}件の監査エラー:\n${failures.slice(0, 30).join("\n")}`,
    );
  return {
    pages: urls.length,
    details,
    detailCounts,
    redirects: redirects.length,
    titleCount: titles.size,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const directory = process.argv[2] || "dist";
  const origin = process.argv[3] || SITE_ORIGIN;
  const basePath = process.argv[4] || "/";
  console.log(auditBuild({ directory, origin, basePath }));
}
