import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadGameCatalog } from "../scripts/catalog.mjs";
import { GAMES } from "../src/js/site-config.js";
import { renderList, renderDetail } from "../src/js/views.js";
import { detailTitle, detailDescription } from "../src/js/seo.js";

test("Our Notes launch catalog retains IDs, evidence and only known fields", () => {
  const game = GAMES.ournotes;
  const songs = loadGameCatalog(game);
  assert.equal(songs.length, 78);
  assert.equal(new Set(songs.map((song) => song.stableSongId)).size, 78);
  assert.equal(new Set(songs.map((song) => song.band)).size, 5);
  assert.equal(songs[0].title, "迷星叫");
  assert.equal(songs.at(-1).title, "サムライハート(Some Like It Hot!!)");
  assert.ok(
    songs.every((song) =>
      song.sourceURL.startsWith("https://www.fromtyo.jp/media/"),
    ),
  );
  assert.ok(
    songs.every((song) => song.bpm === null && song.difficulties.length === 0),
  );
  assert.ok(!songs.some((song) => song.title === "ちゅ、多様性。"));
  assert.ok(!detailTitle(songs[0], game, songs).includes("BPM"));
  assert.ok(!detailDescription(songs[0], game).includes("BPM"));
  assert.ok(!detailDescription(songs[0], game).includes("難易度"));
});

test("Our Notes list searches known songs and detail renders source without fabricated charts", () => {
  const game = GAMES.ournotes;
  const songs = loadGameCatalog(game);
  const data = { updatedAt: "2026-09-25", songs };
  const all = renderList(data, new URLSearchParams(), "/", game);
  assert.equal((all.match(/class="song-title"/g) || []).length, 78);
  const filtered = renderList(
    data,
    new URLSearchParams(
      "q=%E8%BF%B7%E6%98%9F%E5%8F%AB&band=MyGO%21%21%21%21%21",
    ),
    "/",
    game,
  );
  assert.equal((filtered.match(/class="song-title"/g) || []).length, 1);
  assert.match(filtered, /ournotes\/songs\/1\//);
  const detail = renderDetail(songs[0], data, new URLSearchParams(), "/", game);
  assert.match(detail, /MyGO!!!!!/);
  assert.match(detail, /収録曲の公式発表を見る/);
  assert.doesNotMatch(detail, /<table|基本BPM/);
  const generated = fs.readFileSync("dist/ournotes/songs/1/index.html", "utf8");
  assert.match(generated, /<h1>迷星叫<\/h1>/);
  assert.match(generated, /MyGO!!!!!/);
});
