import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateSong } from "../src/song-schema.js";
import { compareSongs } from "../src/domain.js";
import { formatDuration, renderDetail, renderList } from "../src/views.js";

const song = JSON.parse(
  fs.readFileSync("data/songs/空色デイズ/song.json", "utf8"),
);
test("timing validates decimals, unknowns and constant/variable BPM", () => {
  const check = (fields) =>
    validateSong(
      {
        ...song,
        bpm: null,
        bpmMin: null,
        bpmMax: null,
        durationSeconds: null,
        ...fields,
      },
      "空色デイズ",
    );
  check({});
  check({ bpm: 174.5, durationSeconds: 104.928 });
  check({ bpm: 174, bpmMin: 174, bpmMax: 174 });
  check({ bpm: 174, bpmMin: 90.25, bpmMax: 200.5 });
  for (const fields of [
    { bpm: 0 },
    { bpm: -1 },
    { bpm: "174" },
    { bpm: Infinity },
    { durationSeconds: NaN },
    { durationSeconds: -5 },
    { bpm: 180, bpmMin: 100 },
    { bpmMin: 90, bpmMax: 200 },
    { bpm: 180, bpmMin: 190, bpmMax: 200 },
    { bpm: 180, bpmMin: 90, bpmMax: 170 },
  ])
    assert.throws(() => check(fields), /BPM|bpm|durationSeconds/);
});
test("timing sorts by basic BPM or game duration with band/type/date ties and unknowns last", () => {
  const base = { band: "Poppin'Party", type: "normal", publishedAt: 0, seq: 0 };
  const rows = [
    { ...base, id: 1, bpm: 200, bpmMax: 200, durationSeconds: 90 },
    { ...base, id: 2, bpm: 100, bpmMax: 500, durationSeconds: 300 },
    { ...base, id: 3, bpm: null, durationSeconds: null },
    { ...base, id: 4, band: "Roselia", bpm: 200, durationSeconds: 90 },
    { ...base, id: 5, type: "anime", bpm: 200, durationSeconds: 90 },
    { ...base, id: 6, publishedAt: 1, bpm: 200, durationSeconds: 90 },
  ];
  assert.deepEqual(
    [...rows].sort(compareSongs("bpm")).map((s) => s.id),
    [1, 6, 5, 4, 2, 3],
  );
  assert.deepEqual(
    [...rows].sort(compareSongs("duration")).map((s) => s.id),
    [2, 1, 6, 5, 4, 3],
  );
});
test("duration formatting preserves milliseconds and carries into minutes", () => {
  for (const [value, text] of [
    [104.928, "1:44.928"],
    [105.384, "1:45.384"],
    [120, "2:00"],
    [60.04, "1:00.04"],
    [59.9996, "1:00"],
    [5, "0:05"],
    [null, "未確認"],
  ])
    assert.equal(formatDuration(value), text);
});
test("timing is visible on direct detail and sort selection survives detail navigation", () => {
  const row = {
    id: 1,
    slug: "test",
    title: "テスト",
    reading: "テスト",
    band: "Roselia",
    type: "normal",
    publishedAt: 0,
    bpm: 174,
    bpmMin: 90,
    bpmMax: 200,
    durationSeconds: 104.928,
    difficulties: Array(5).fill(null),
  };
  const data = { songs: [row], updatedAt: 0 };
  assert.match(renderDetail(row, data), /基本BPM<\/dt><dd>174/);
  assert.match(renderDetail(row, data), /90 〜 200/);
  assert.match(renderDetail(row, data), /1:44.928/);
  for (const sort of ["bpm", "duration"]) {
    const params = new URLSearchParams({ sort, type: "normal", band: "3" });
    const html = renderList(data, params, "/garupa-song-atlas/");
    assert.match(html, new RegExp(`data-sort="${sort}" aria-pressed="true"`));
    assert.ok(html.includes(`sort=${sort}&amp;type=normal&amp;band=3`));
  }
});
