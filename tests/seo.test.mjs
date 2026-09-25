import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { auditBuild } from "../scripts/qa/audit-build.mjs";
import { GAMES, siteSettings } from "../src/js/site-config.js";
import { songPath } from "../src/js/urls.js";
import { detailTitle } from "../src/js/seo.js";

test("generated canonical pages, structured data, links and sitemap are consistent", () => {
  const settings = siteSettings(process.env);
  const result = auditBuild({
    origin: settings.origin,
    basePath: settings.basePath,
  });
  const count = JSON.parse(fs.readFileSync("dist/garupa/songs.json", "utf8"))
    .songs.length;
  const ournotesCount = JSON.parse(
    fs.readFileSync("dist/ournotes/songs.json", "utf8"),
  ).songs.length;
  const legacy = JSON.parse(
    fs.readFileSync("data/garupa/legacy-song-paths.json", "utf8"),
  );
  assert.equal(result.details, count + ournotesCount);
  assert.deepEqual(result.detailCounts, {
    garupa: count,
    ournotes: ournotesCount,
  });
  assert.equal(
    result.redirects,
    legacy.reduce((n, entry) => n + entry.slugs.length, 0),
  );
  assert.equal(result.pages, count + ournotesCount + 6);
});

test("site settings normalize both deployment bases and reject conflicting settings", () => {
  const pages = siteSettings({
    SITE_ORIGIN: "https://example.test",
    BASE_PATH: "/garupa-song-atlas",
  });
  assert.equal(pages.basePath, "/garupa-song-atlas/");
  assert.equal(pages.origin, "https://example.test");
  assert.equal(siteSettings({ BASE_PATH: "/" }).basePath, "/");
  assert.throws(
    () => siteSettings({ BASE_PATH: "/", SITE_BASE_PATH: "/wrong" }),
    /一致/,
  );
  assert.throws(
    () => siteSettings({ SITE_ORIGIN: "https://example.test/path" }),
    /SITE_ORIGIN/,
  );
});

test("same-title songs get unique titles and stable paths", () => {
  const songs = JSON.parse(
    fs.readFileSync("dist/garupa/songs.json", "utf8"),
  ).songs;
  const duplicates = songs.filter((song) => song.title === "オレンジ");
  assert.equal(duplicates.length, 2);
  assert.notEqual(
    detailTitle(duplicates[0], GAMES.garupa, songs),
    detailTitle(duplicates[1], GAMES.garupa, songs),
  );
  assert.equal(songPath(GAMES.garupa, "24"), "garupa/songs/24/");
});

test("query robots applies to list state but not detail queries", () => {
  const source = fs.readFileSync("src/js/query-index.js", "utf8");
  const check = (pathname, search) => {
    const appended = [];
    const document = {
      currentScript: {
        src: "https://example.test/atlas/query-index.js",
        dataset: {
          indexPage: /\/songs\/$/.test(pathname)
            ? "list"
            : pathname === "/atlas/"
              ? "root"
              : "detail",
        },
      },
      head: { append: (node) => appended.push(node) },
      createElement: () => ({}),
    };
    vm.runInNewContext(source, {
      location: { pathname, search },
      document,
      URL,
      URLSearchParams,
    });
    return appended[0]?.content;
  };
  assert.equal(check("/atlas/garupa/songs/", "?q="), "noindex,follow");
  assert.equal(
    check("/atlas/ournotes/songs/", "?sort=level"),
    "noindex,follow",
  );
  assert.equal(check("/atlas/", "?page=2"), "noindex,follow");
  assert.equal(check("/atlas/garupa/songs/24/", "?q=x"), undefined);
  assert.equal(check("/atlas/garupa/songs/", ""), undefined);
});
