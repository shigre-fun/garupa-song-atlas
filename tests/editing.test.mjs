import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadCatalog } from "../scripts/catalog.mjs";
import { renderDetail } from "../src/js/views.js";

test("new-song command adds a template entry without changing existing IDs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "garupa-edit-test-"));
  try {
    fs.mkdirSync(path.join(root, "data/garupa"), { recursive: true });
    fs.mkdirSync(path.join(root, "templates"));
    fs.copyFileSync(
      "templates/song.json",
      path.join(root, "templates/song.json"),
    );
    const file = path.join(root, "data/garupa/songs.json");
    fs.writeFileSync(file, JSON.stringify({ groups: [] }));
    fs.writeFileSync(
      path.join(root, "data/garupa/admin-state.json"),
      JSON.stringify({ nextId: 7, updatedAt: "2026-09-17T00:00:00Z" }),
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [path.resolve("scripts/add-song.mjs"), "新曲テスト"],
        {
          cwd: root,
          encoding: "utf8",
        },
      );
    assert.equal(run().status, 0);
    let data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.groups[0].songs[0].id, 7);
    assert.throws(() => loadCatalog(file), /楽曲グループ/);
    data.groups[0].band = "Roselia";
    const song = data.groups[0].songs[0];
    song.reading = "シンキョクテスト";
    song.releaseDate = "2026-09-17T15:00:00+09:00";
    for (const chart of Object.values(song.difficulties))
      if (chart) Object.assign(chart, { level: 20, notes: 500 });
    song.difficulties.EXPERT.notes = 987;
    fs.writeFileSync(file, JSON.stringify(data));
    const catalog = loadCatalog(file);
    assert.equal(catalog[0].id, 7);
    assert.equal(catalog[0].difficulties[3].notes, 987);
    assert.ok(
      renderDetail(catalog[0], { updatedAt: song.releaseDate }).includes("987"),
    );
    assert.equal(run().status, 0);
    data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(
      data.groups.flatMap((group) => group.songs.map((entry) => entry.id)),
      [7, 8],
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(root, "data/garupa/admin-state.json")),
      ).nextId,
      9,
    );
  } finally {
    const parent = path.resolve(os.tmpdir());
    assert.ok(path.resolve(root).startsWith(parent + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy URL pages and rendered details remain available", () => {
  const legacy = JSON.parse(
    fs.readFileSync("data/garupa/legacy-song-paths.json"),
  );
  const ids = new Set(loadCatalog().map((song) => song.stableSongId));
  assert.equal(legacy.length, 797);
  for (const entry of legacy) {
    assert.ok(ids.has(entry.stableSongId));
    for (const slug of entry.slugs) {
      const html = fs.readFileSync(`dist/songs/${slug}/index.html`, "utf8");
      assert.ok(html.includes(`/garupa/songs/${entry.stableSongId}/`));
    }
  }
});
