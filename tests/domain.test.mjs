import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compareSongs, matches, bandOrder, bandNames } from "../dist/domain.js";
const songs = JSON.parse(fs.readFileSync("dist/songs.json", "utf8")).songs;
test("required band order and guest collaborations", () => {
  assert.deepEqual(
    bandNames.map((band) => bandOrder({ band })),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(bandOrder({ band: "RAISE A SUILEN×星街すいせい" }), 6);
  assert.equal(bandOrder({ band: "CRYCHIC" }), 9);
  assert.equal(
    bandOrder({ band: "Poppin'Party×Pastel＊Palettes×Morfonica" }),
    9,
  );
});
test("sort tie breakers are band, category, release; missing difficulty is last", () => {
  const s = (id, band, type, time, level) => ({
    id,
    band,
    type,
    publishedAt: time,
    difficulties: [level ? { level } : null],
  });
  const data = [
    s(1, "Roselia", "normal", 1, 20),
    s(2, "Poppin'Party", "anime", 1, 20),
    s(3, "Poppin'Party", "normal", 3, 20),
    s(4, "Poppin'Party", "normal", 2, 20),
    s(5, "Roselia", "normal", 1, 21),
    s(6, "Poppin'Party", "normal", 1, null),
  ];
  assert.deepEqual(
    data.sort(compareSongs("level-0")).map((x) => x.id),
    [5, 4, 3, 2, 1, 6],
  );
});
test("English songs sort by Japanese reading", () => {
  const data = [
    {
      id: 1,
      title: "Z",
      reading: "ア",
      publishedAt: 0,
      band: "Roselia",
      type: "normal",
    },
    {
      id: 2,
      title: "A",
      reading: "ゼット",
      publishedAt: 0,
      band: "Roselia",
      type: "normal",
    },
  ];
  assert.deepEqual(
    data.sort(compareSongs("kana")).map((x) => x.id),
    [1, 2],
  );
});
test("search supports original works and width/kana/case differences", () => {
  const s = {
    title: "LOUDER",
    reading: "ラウダー",
    work: "TVアニメ「天元突破グレンラガン」OP",
  };
  assert.ok(matches(s, "ｌｏｕｄｅｒ"));
  assert.ok(matches(s, "らうだー"));
  assert.ok(matches(s, "グレンラガン"));
  assert.ok(!matches(s, "存在しない作品"));
});
test("catalog contains all five difficulty slots, readings, IDs and generated pages", () => {
  assert.ok(songs.length > 750);
  assert.equal(new Set(songs.map((s) => s.id)).size, songs.length);
  for (const s of songs) {
    assert.ok(s.reading, s.title);
    assert.equal(s.difficulties.length, 5);
    assert.ok(fs.existsSync(`dist/songs/${s.slug}/index.html`));
    assert.ok(["normal", "anime", "tie_up"].includes(s.type));
    for (const d of s.difficulties.filter(Boolean)) {
      assert.ok(d.level > 0 && d.level <= 50, s.title);
      assert.ok(Number.isInteger(d.notes) && d.notes > 0, s.title);
    }
  }
});
test("3D versions remain independent and support may be unknown", () => {
  assert.equal(songs.find((s) => s.id === 484).live3d, true);
  assert.equal(songs.find((s) => s.id === 158).live3d, false);
  assert.equal(songs.find((s) => s.id === 24).live3d, true);
  for (const s of songs.filter((s) => s.type === "normal"))
    assert.ok(s.live3d === null || typeof s.live3d === "boolean");
});
test("all sort modes cover the same complete catalog deterministically", () => {
  for (const mode of [
    "band",
    "kana",
    "release",
    ...Array.from({ length: 5 }, (_, i) => `level-${i}`),
  ]) {
    const comparator = compareSongs(mode),
      sorted = [...songs].sort(comparator);
    assert.equal(sorted.length, songs.length);
    for (let i = 1; i < sorted.length; i++)
      assert.ok(comparator(sorted[i - 1], sorted[i]) <= 0);
  }
});
test("original metadata permits explicitly unknown values", () => {
  for (const s of songs.filter((s) => s.type !== "normal")) {
    assert.ok(s.artist === null || typeof s.artist === "string");
    assert.ok(s.composer === null || typeof s.composer === "string");
    assert.ok(
      s.work === null || typeof s.work === "string",
      `Work status missing: ${s.title}`,
    );
  }
});
