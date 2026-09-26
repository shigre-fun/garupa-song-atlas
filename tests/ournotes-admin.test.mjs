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
  const options = await store.listSongs();
  assert.equal(options.length, originalCount);
  const ids = options.map((song) => song.id);
  assert.deepEqual(
    ids,
    [...ids].sort((a, b) => a - b),
  );
  const original = await store.loadSong(1);
  assert.equal(original.song.id, 1);
  const input = {
    ...original.song,
    id: 1,
    title: "管理画面で追加した曲",
    reading: "カンリガメンデツイカシタキョク",
    releaseOrder: nextId,
  };
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
  const changed = {
    ...added.editing.song,
    title: "追加直後に修正した曲",
    composer: "確認済み作曲者",
  };
  await store.updateSong(changed, added.editing, "ournotes-edit-00000001");
  assert.equal(
    listGarupaSongs(files[game.dataFile], game.id).length,
    originalCount + 1,
  );
  assert.equal((await store.loadSong(nextId)).song.composer, "確認済み作曲者");
  assert.ok(
    proposed.tree.every((entry) => entry.path.startsWith("data/ournotes/")),
  );
  assert.ok(!calls.some(([, route]) => route.includes("garupa")));
});
