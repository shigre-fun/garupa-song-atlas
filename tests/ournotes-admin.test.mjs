import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GitHubStore } from "../src/js/github-store.js";
import { GAMES } from "../src/js/site-config.js";
import { findGarupaSong, listGarupaSongs } from "../src/js/garupa-data.js";

test("Our Notes administrator adds and edits within its own catalog", async () => {
  const game = GAMES.ournotes;
  const files = {
    [game.dataFile]: JSON.parse(fs.readFileSync(game.dataFile, "utf8")),
    [game.stateFile]: JSON.parse(fs.readFileSync(game.stateFile, "utf8")),
    [GAMES.garupa.dataFile]: JSON.parse(
      fs.readFileSync(GAMES.garupa.dataFile, "utf8"),
    ),
  };
  const originalCount = listGarupaSongs(files[game.dataFile], game.id).length;
  const nextId = files[game.stateFile].nextId;
  let head = "initial";
  let proposed;
  const calls = [];
  const json = (value) => new Response(JSON.stringify(value));
  const fetcher = async (url, options) => {
    const route = url.replace(
      "https://api.github.com/repos/test-owner/song-atlas",
      "",
    );
    calls.push([options.method, route]);
    if (route === "") return json({ permissions: { push: true } });
    if (route.startsWith("/git/ref/")) return json({ object: { sha: head } });
    if (route.startsWith("/git/commits/") && options.method === "GET")
      return json({ tree: { sha: "tree" } });
    if (route.startsWith("/git/trees/") && options.method === "GET")
      return json({
        truncated: false,
        tree: [
          { path: "scripts/build.mjs", type: "blob", sha: "build" },
          ...Object.keys(files).map((path, i) => ({
            path,
            type: "blob",
            sha: `file-${i}`,
          })),
        ],
      });
    if (route.startsWith("/git/blobs/")) {
      const file =
        Object.values(files)[Number(route.slice("/git/blobs/file-".length))];
      const bytes = Buffer.from(JSON.stringify(file));
      return json({
        encoding: "base64",
        size: bytes.length,
        content: bytes.toString("base64"),
      });
    }
    if (route === "/git/trees" && options.method === "POST") {
      proposed = JSON.parse(options.body);
      return json({ sha: "new-tree" });
    }
    if (route === "/git/commits" && options.method === "POST")
      return json({ sha: `head-${calls.length}` });
    if (route.startsWith("/git/refs/")) {
      assert.equal(JSON.parse(options.body).force, false);
      for (const entry of proposed.tree)
        files[entry.path] = JSON.parse(entry.content);
      head = `head-${calls.length}`;
      return json({ object: { sha: head } });
    }
    throw new Error(`Unexpected route: ${route}`);
  };
  const store = new GitHubStore(
    { owner: "test-owner", repo: "song-atlas", branch: "main" },
    "test-token",
    fetcher,
    game,
  );
  await store.connect();
  // 一覧は入力項目の検証エラーで止めず、編集時に個別検証する。
  files[game.dataFile].groups[0].songs[0].live3d = null;
  const options = await store.listSongs();
  assert.equal(options.length, originalCount);
  const bothGames = await store.listSongsByGame();
  assert.equal(bothGames.ournotes.length, originalCount);
  assert.ok(bothGames.garupa.some((song) => song.id === 667));
  assert.ok(
    bothGames.ournotes.some(
      (song) => song.title === "春日影（MyGO!!!!! ver.）",
    ),
  );
  delete files[game.dataFile].groups[0].songs[0].live3d;
  const ids = options.map((song) => song.id);
  assert.deepEqual(
    ids,
    [...ids].sort((a, b) => a - b),
  );
  const original = await store.loadSong(1);
  assert.equal(original.song.id, 1);
  assert.deepEqual(original.song.relatedSongIds, ["garupa:489", "garupa:649"]);
  assert.deepEqual(
    original.song.relatedSongIds.map((reference) => {
      const [gameId, id] = reference.split(":");
      const song = bothGames[gameId].find((item) => item.id === Number(id));
      return `${GAMES[gameId].shortName}：${song.title}`;
    }),
    ["ガルパ：迷星叫", "ガルパ：迷星叫(パラレルver.)"],
  );
  const input = {
    ...original.song,
    id: 1,
    title: "管理画面で追加した曲",
    reading: "カンリガメンデツイカシタキョク",
    releaseOrder: nextId,
    relatedSongIds: ["garupa:667"],
  };
  const writesBeforeInvalid = calls.filter(
    ([method]) => method !== "GET",
  ).length;
  await assert.rejects(
    store.addSong(
      { ...input, relatedSongIds: ["garupa:999999"] },
      "ournotes-bad-link-00001",
    ),
    /関連楽曲が見つかりません/,
  );
  assert.equal(
    calls.filter(([method]) => method !== "GET").length,
    writesBeforeInvalid,
  );
  const added = await store.addSong(input, "ournotes-add-00000001");
  assert.equal(added.id, nextId);
  assert.equal(files[game.stateFile].nextId, nextId + 1);
  assert.equal(
    listGarupaSongs(files[game.dataFile], game.id).length,
    originalCount + 1,
  );
  assert.equal(
    findGarupaSong(files[game.dataFile], 1).song.title,
    original.song.title,
  );
  assert.deepEqual(
    findGarupaSong(files[GAMES.garupa.dataFile], 667).song.relatedSongIds,
    ["ournotes:7", `ournotes:${nextId}`],
  );
  assert.ok(
    proposed.tree.some((entry) => entry.path === GAMES.garupa.dataFile),
  );
  const changed = {
    ...added.editing.song,
    title: "追加直後に修正した曲",
    composer: "確認済み作曲者",
    relatedSongIds: [],
  };
  await store.updateSong(changed, added.editing, "ournotes-edit-00000001");
  assert.equal(
    listGarupaSongs(files[game.dataFile], game.id).length,
    originalCount + 1,
  );
  assert.equal((await store.loadSong(nextId)).song.composer, "確認済み作曲者");
  assert.deepEqual(
    findGarupaSong(files[GAMES.garupa.dataFile], 667).song.relatedSongIds,
    ["ournotes:7"],
  );
  assert.ok(
    proposed.tree.some((entry) => entry.path === GAMES.garupa.dataFile),
  );
  const existing = await store.loadSong(1);
  await store.updateSong(
    { ...existing.song, relatedSongIds: [] },
    existing,
    "ournotes-remove-000001",
  );
  assert.deepEqual((await store.loadSong(1)).song.relatedSongIds, []);
  for (const id of [489, 649])
    assert.ok(
      !findGarupaSong(
        files[GAMES.garupa.dataFile],
        id,
      ).song.relatedSongIds.includes("ournotes:1"),
    );
});

test("editor orders BPM fields and serves a searchable song picker with fresh modules", () => {
  const html = fs.readFileSync("dist/admin/index.html", "utf8");
  const fields = ["bpm", "bpmMin", "bpmMax", "durationSeconds"].map((name) =>
    html.indexOf(`name="${name}"`),
  );
  assert.ok(fields.every((position) => position >= 0));
  assert.deepEqual(
    fields,
    [...fields].sort((a, b) => a - b),
  );
  for (const id of [
    "add-related-song",
    "related-game",
    "related-search",
    "related-song",
    "confirm-related-song",
    "related-selected",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.doesNotMatch(html, /placeholder="garupa:667/);
  const version = html.match(/admin\.js\?v=([a-f0-9]{12})/)?.[1];
  assert.ok(version);
  assert.ok(html.includes(`admin.css?v=${version}`));
  const admin = fs.readFileSync("dist/admin.js", "utf8");
  const store = fs.readFileSync("dist/github-store.js", "utf8");
  assert.ok(admin.includes(`./github-store.js?v=${version}`));
  assert.ok(admin.includes(`./related-song-picker.js?v=${version}`));
  assert.ok(store.includes(`./song-schema.js?v=${version}`));
});
