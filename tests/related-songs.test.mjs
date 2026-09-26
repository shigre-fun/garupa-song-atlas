import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GAMES, siteSettings } from "../src/js/site-config.js";
import { loadGameCatalog } from "../scripts/catalog.mjs";
import {
  baseSongTitle,
  relatedSongs,
  validateRelatedSongIds,
} from "../src/js/related-songs.js";

const catalogs = Object.fromEntries(
  Object.values(GAMES).map((game) => [game.id, loadGameCatalog(game)]),
);
const byId = (game, id) => catalogs[game].find((song) => song.id === id);
const ids = (song) =>
  relatedSongs(song, catalogs).map(
    (related) => `${related.gameId}:${related.id}`,
  );
const page = (game, id) =>
  fs.readFileSync(`dist/${game}/songs/${id}/index.html`, "utf8");

test("chart variants and cross-game songs link in both directions", () => {
  assert.doesNotThrow(() => validateRelatedSongIds(catalogs));
  assert.equal(
    baseSongTitle("[FULL] キズナミュージック♪"),
    "キズナミュージック♪",
  );
  assert.deepEqual(ids(byId("garupa", 158)), ["garupa:249", "garupa:484"]);
  assert.deepEqual(ids(byId("garupa", 249)), ["garupa:158", "garupa:484"]);
  assert.deepEqual(ids(byId("garupa", 489)), ["garupa:649", "ournotes:1"]);
  assert.deepEqual(ids(byId("ournotes", 1)), ["garupa:489", "garupa:649"]);
  assert.deepEqual(ids(byId("ournotes", 40)), ["garupa:87"]);
  assert.deepEqual(ids(byId("ournotes", 7)), ["garupa:667"]);
  assert.deepEqual(ids(byId("garupa", 667)), ["ournotes:7"]);
  assert.deepEqual(ids(byId("garupa", 410)), []); // 同名異曲
});

test("explicit links must point to an existing song in both directions", () => {
  const song = {
    ...byId("ournotes", 7),
    relatedSongIds: ["garupa:667", "garupa:999999"],
  };
  assert.throws(
    () =>
      validateRelatedSongIds({
        ...catalogs,
        ournotes: catalogs.ournotes.map((entry) =>
          entry.id === 7 ? song : entry,
        ),
      }),
    /関連楽曲.*不正/,
  );
  const unpaired = { ...byId("garupa", 667), relatedSongIds: [] };
  assert.throws(
    () =>
      validateRelatedSongIds({
        ...catalogs,
        garupa: catalogs.garupa.map((entry) =>
          entry.id === 667 ? unpaired : entry,
        ),
      }),
    /相互/,
  );
});

test("public pages avoid admin links while the direct editor remains available", () => {
  const base = siteSettings(process.env).basePath;
  const garupa = page("garupa", 489);
  const ournotes = page("ournotes", 1);
  assert.ok(garupa.includes(`href="${base}garupa/songs/649/"`));
  assert.ok(garupa.includes(`href="${base}ournotes/songs/1/"`));
  assert.ok(ournotes.includes(`href="${base}garupa/songs/489/"`));
  assert.ok(ournotes.includes(`href="${base}garupa/songs/649/"`));
  for (const html of [
    garupa,
    ournotes,
    fs.readFileSync("dist/index.html", "utf8"),
  ]) {
    assert.ok(html.includes(`href="${base}garupa/songs/"`));
    assert.ok(html.includes(`href="${base}ournotes/songs/"`));
    assert.ok(!html.includes(`${base}admin/`));
  }
  const home = fs.readFileSync("dist/index.html", "utf8");
  assert.match(home, /<h2>バンドリ！ガールズバンドパーティ！<\/h2>/);
  assert.match(home, /<h2>バンドリ！アワーノーツ<\/h2>/);
  const admin = fs.readFileSync("dist/admin/index.html", "utf8");
  assert.match(admin, /楽曲を追加・修正/);
  assert.match(admin, /name="robots" content="noindex,nofollow"/);
  for (const asset of [
    "admin.js",
    "admin.css",
    "github-store.js",
    "admin-config.json",
  ])
    assert.ok(fs.existsSync(`dist/${asset}`), asset);
  assert.ok(!fs.existsSync("dist/garupa/index.html"));
  assert.ok(!fs.existsSync("dist/ournotes/index.html"));
});
