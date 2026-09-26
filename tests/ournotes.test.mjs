import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadGameCatalog } from "../scripts/catalog.mjs";
import { GAMES } from "../src/js/site-config.js";
import {
  bandOrder,
  filteredSongs,
  sortState,
  compareSongs,
} from "../src/js/domain.js";
import { renderList, renderDetail } from "../src/js/views.js";
import { listGarupaSongs } from "../src/js/garupa-data.js";

const game = GAMES.ournotes;
const songs = loadGameCatalog(game);
const data = { updatedAt: "2026-09-25", songs };

test("Our Notes stores MV status without Garupa-only fields", () => {
  const raw = JSON.parse(fs.readFileSync(game.dataFile, "utf8"));
  const exceptions = new Set([
    "碧い瞳の中に",
    "everscape",
    "カーネーションの咲く日に",
    "ジャイアント・キラー・チューン",
    "Keep on Riddim",
  ]);
  const originals = raw.groups
    .filter((group) => group.category === "オリジナル")
    .flatMap((group) => group.songs);
  assert.equal(originals.filter((song) => song.mv === false).length, 5);
  for (const song of originals)
    assert.equal(song.mv, !exceptions.has(song.title), song.title);
  for (const song of listGarupaSongs(raw, game.id)) {
    assert.ok(!Object.hasOwn(song, "live3d"), song.title);
    assert.ok(!Object.hasOwn(song.difficulties, "SPECIAL"), song.title);
  }
  const present = renderDetail(
    songs.find((song) => song.id === 1),
    data,
    new URLSearchParams(),
    "/",
    game,
  );
  const absent = renderDetail(
    songs.find((song) => song.id === 38),
    data,
    new URLSearchParams(),
    "/",
    game,
  );
  assert.match(
    present,
    /<dt>MV<\/dt><dd><span class="pill">あり<\/span><\/dd>/,
  );
  assert.match(absent, /<dt>MV<\/dt><dd>なし<\/dd>/);
});

test("Our Notes retains launch IDs as its catalog grows", () => {
  const ids = new Set(songs.map((song) => song.id));
  assert.ok(songs.length >= 78);
  assert.equal(ids.size, songs.length);
  for (let id = 1; id <= 78; id++) assert.ok(ids.has(id), `launch ID ${id}`);
  assert.ok(
    songs.every(
      (song) => song.difficulties.length === game.difficulties.length,
    ),
  );
});

test("Our Notes renders added songs and populated chart fields", () => {
  const total = Math.ceil(songs.length / 50) * 50 + 1;
  const nextId = Math.max(...songs.map((song) => song.id)) + 1;
  const prototype = songs.find((song) => song.id === 1);
  const added = Array.from({ length: total - songs.length }, (_, index) => {
    const id = nextId + index;
    return {
      ...prototype,
      id,
      stableSongId: String(id),
      slug: String(id),
      title: `追加曲${id}`,
      bpm: 180,
      bpmMin: 180,
      bpmMax: 180,
      durationSeconds: 120,
      difficulties: game.difficulties.map(() => ({ level: 20, notes: 500 })),
    };
  });
  const future = { ...data, songs: [...songs, ...added] };
  const lastPage = Math.ceil(total / 50);
  const list = renderList(
    future,
    new URLSearchParams({ page: String(lastPage) }),
    "/",
    game,
  );
  assert.ok(list.includes(`${lastPage} / ${lastPage}`));
  assert.equal((list.match(/class="song-title"/g) || []).length, 1);
  const detail = renderDetail(
    added[0],
    future,
    new URLSearchParams(),
    "/",
    game,
  );
  for (const value of ["180", "2:00", "500"]) assert.ok(detail.includes(value));
});

test("Our Notes list uses Garupa controls, multiple filters and seven sort modes", () => {
  const all = renderList(data, new URLSearchParams(), "/", game);
  assert.equal(
    (all.match(/class="song-title"/g) || []).length,
    Math.min(50, songs.length),
  );
  assert.ok(all.includes(`1 / ${Math.ceil(songs.length / 50)}`));
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
  const target = songs.find((song) => song.id === 1);
  const targetBand = bandOrder(target, game);
  const params = new URLSearchParams();
  params.append("type", target.type);
  params.append(
    "type",
    game.categories.find((type) => type !== target.type),
  );
  params.append("band", String(targetBand));
  params.append("band", String(targetBand === 0 ? 1 : 0));
  params.set("q", target.title);
  const matches = filteredSongs(songs, params, game).sort(
    compareSongs("band", "forward", 3, game),
  );
  const position = matches.findIndex((song) => song.id === target.id);
  assert.ok(position >= 0);
  params.set("page", String(Math.floor(position / 50) + 1));
  const filtered = renderList(data, params, "/", game);
  assert.match(filtered, /ournotes\/songs\/1\//);
  assert.equal(
    (filtered.match(/class="song-title"/g) || []).length,
    Math.min(50, matches.length - Math.floor(position / 50) * 50),
  );
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
      songs.length,
    );
});

test("Our Notes detail follows Garupa field order without official-image link", () => {
  const target = songs.find((song) => song.id === 1);
  const detail = renderDetail(target, data, new URLSearchParams(), "/", game);
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
  const heading = detail.match(/<h1>.*?<\/h1>/s)?.[0];
  assert.ok(heading && generated.includes(heading));
  assert.match(generated, /アワーノーツの楽曲名・作品名で検索/);
  assert.match(
    generated,
    /action="\/(?:garupa-song-atlas\/)?ournotes\/songs\/"/,
  );
});
