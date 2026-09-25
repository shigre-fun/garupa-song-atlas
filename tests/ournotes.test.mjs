import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadGameCatalog } from "../scripts/catalog.mjs";
import { GAMES } from "../src/js/site-config.js";
import { filteredSongs, sortState, compareSongs } from "../src/js/domain.js";
import { renderList, renderDetail } from "../src/js/views.js";

const game = GAMES.ournotes;
const songs = loadGameCatalog(game);
const data = { updatedAt: "2026-09-25", songs };

test("Our Notes retains launch songs and leaves unverified facts empty", () => {
  assert.equal(songs.length, 78);
  assert.equal(new Set(songs.map((song) => song.stableSongId)).size, 78);
  assert.equal(new Set(songs.map((song) => song.band)).size, 5);
  assert.equal(songs[0].title, "迷星叫");
  assert.equal(songs.at(-1).title, "サムライハート(Some Like It Hot!!)");
  assert.ok(songs.every((song) => song.reading.trim()));
  assert.equal(songs[0].composer, "長谷川大介(SUPA LOVE)");
  assert.equal(
    songs.find((song) => song.title === "unravel").work,
    "アニメ「東京喰種トーキョーグール」",
  );
  assert.ok(
    songs.every((song) => song.bpm === null && song.difficulties.length === 4),
  );
  assert.ok(
    songs.every((song) =>
      song.difficulties.every(
        (chart) => chart.level === null && chart.notes === null,
      ),
    ),
  );
  assert.ok(!songs.some((song) => song.title === "ちゅ、多様性。"));
  assert.ok(
    JSON.parse(fs.readFileSync(game.dataFile, "utf8")).groups.every((group) =>
      group.sourceURL.startsWith("https://www.fromtyo.jp/media/"),
    ),
  );
});

test("Our Notes list uses Garupa controls, multiple filters and seven sort modes", () => {
  const all = renderList(data, new URLSearchParams(), "/", game);
  assert.equal((all.match(/class="song-title"/g) || []).length, 50);
  assert.match(all, /1 \/ 2/);
  for (const band of game.bands) assert.ok(all.includes(band));
  for (const mode of [
    "band",
    "level",
    "notes",
    "bpm",
    "duration",
    "kana",
    "release",
  ])
    assert.ok(all.includes(`data-sort="${mode}"`));
  assert.equal(sortState(new URLSearchParams(), game).difficulty, 3);
  assert.doesNotMatch(all, /SPECIAL|エクストラ/);
  const params = new URLSearchParams(
    "type=normal&type=anime&band=0&band=1&q=迷星叫",
  );
  assert.deepEqual(
    filteredSongs(songs, params, game).map((song) => song.id),
    [1],
  );
  const filtered = renderList(data, params, "/", game);
  assert.match(filtered, /ournotes\/songs\/1\//);
  assert.equal((filtered.match(/class="song-title"/g) || []).length, 1);
  for (const mode of [
    "band",
    "level",
    "notes",
    "bpm",
    "duration",
    "kana",
    "release",
  ])
    assert.equal(
      [...songs].sort(compareSongs(mode, "forward", 3, game)).length,
      78,
    );
});

test("Our Notes detail follows Garupa field order without official-image link", () => {
  const detail = renderDetail(songs[0], data, new URLSearchParams(), "/", game);
  const headings = [
    "難易度・ノーツ数",
    "楽曲情報",
    "配信日（日本版）",
    "基本BPM",
    "BPMの下限〜上限",
    "楽曲演奏時間（ゲーム内）",
    "演奏バンド・参加アーティスト",
    "作曲",
  ];
  let previous = -1;
  for (const heading of headings) {
    const index = detail.indexOf(heading);
    assert.ok(index > previous, heading);
    previous = index;
  }
  for (const difficulty of game.difficulties)
    assert.ok(detail.includes(difficulty));
  assert.doesNotMatch(
    detail,
    /SPECIAL|収録曲の公式発表を見る|fromtyo.jp\/media/,
  );
  const cover = renderDetail(
    songs.find((song) => song.type === "anime"),
    data,
    new URLSearchParams(),
    "/",
    game,
  );
  assert.match(cover, /原曲アーティスト/);
  assert.match(cover, /原曲の使用作品・タイアップ/);
  const generated = fs.readFileSync("dist/ournotes/songs/1/index.html", "utf8");
  assert.match(generated, /<h1>迷星叫<\/h1>/);
  assert.match(generated, /アワーノーツの楽曲名・作品名で検索/);
  assert.match(
    generated,
    /action="\/(?:garupa-song-atlas\/)?ournotes\/songs\/"/,
  );
});
