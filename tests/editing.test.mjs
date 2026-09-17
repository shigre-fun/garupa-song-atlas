import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadCatalog, folderName } from "../scripts/catalog.mjs";
import { renderDetail } from "../src/views.js";

test("new-song template can be filled, edited and rendered without overwriting existing data", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "garupa-edit-test-"));
  try {
    fs.mkdirSync(path.join(root, "data/songs"), { recursive: true });
    fs.mkdirSync(path.join(root, "templates"));
    fs.copyFileSync(
      "templates/song.json",
      path.join(root, "templates/song.json"),
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [path.resolve("scripts/add-song.mjs"), "新曲テスト", "shinkyoku-test"],
        { cwd: root, encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    const directory = path.join(root, "data/songs");
    assert.throws(() => loadCatalog(directory), /reading/);
    const file = path.join(directory, "shinkyoku-test/song.json");
    const song = JSON.parse(fs.readFileSync(file, "utf8"));
    Object.assign(song, {
      reading: "シンキョクテスト",
      band: "Roselia",
      releaseDate: "2026-09-17T15:00:00+09:00",
    });
    for (const chart of Object.values(song.difficulties))
      if (chart) Object.assign(chart, { level: 20, notes: 500 });
    fs.writeFileSync(file, JSON.stringify(song));
    song.difficulties.EXPERT.notes = 987;
    fs.writeFileSync(file, JSON.stringify(song));
    const catalog = loadCatalog(directory);
    assert.equal(catalog[0].slug, "shinkyoku-test");
    assert.equal(catalog[0].difficulties[3].notes, 987);
    assert.ok(
      renderDetail(catalog[0], { updatedAt: song.releaseDate }).includes("987"),
    );
    const before = fs.readFileSync(file, "utf8");
    assert.notEqual(run().status, 0);
    assert.equal(fs.readFileSync(file, "utf8"), before);
  } finally {
    const parent = path.resolve(os.tmpdir());
    assert.ok(path.resolve(root).startsWith(parent + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("folder names stay readable and generated pages contain no citation sections", () => {
  assert.equal(folderName("曲名/別版?"), "曲名-別版-");
  assert.equal(folderName("CON"), "曲-CON");
  const songs = loadCatalog();
  for (const song of songs) {
    assert.ok(!/^\d+$/.test(song.slug));
    const html = fs.readFileSync(`dist/songs/${song.slug}/index.html`, "utf8");
    assert.ok(!/Bestdori|wikiwiki|出典：|class="sources"/.test(html));
  }
});
