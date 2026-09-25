import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GitHubStore } from "../src/js/github-store.js";
import {
  GARUPA_SONGS_PATH,
  GARUPA_STATE_PATH,
  findGarupaSong,
} from "../src/js/garupa-data.js";
import { validateSong } from "../src/js/song-schema.js";
import { renderDetail, renderList } from "../src/js/views.js";

const submissionId = "test-submission-00000001";
const draft = {
  id: 1,
  title: "テストの新曲",
  reading: "テストノシンキョク",
  category: "カバー",
  band: "Roselia×ゲスト",
  releaseDate: "2026-09-17T15:00+09:00",
  releaseOrder: null,
  composer: null,
  originalArtist: null,
  originalWork: "架空の作品",
  live3d: null,
  bpm: 180,
  bpmMin: 90,
  bpmMax: 200.5,
  durationSeconds: 105,
  aliases: [],
  difficulties: {
    EASY: { level: 5, notes: 100 },
    NORMAL: { level: 10, notes: 200 },
    HARD: { level: 20, notes: 500 },
    EXPERT: { level: 26, notes: 800 },
    SPECIAL: null,
  },
};

test("default browser fetch uses the global receiver", async (t) => {
  t.mock.method(globalThis, "fetch", function () {
    if (this !== globalThis) throw new TypeError("Illegal invocation");
    return Promise.resolve(new Response("{}", { status: 401 }));
  });
  const store = new GitHubStore(
    { owner: "test-owner", repo: "song-atlas", branch: "main" },
    "invalid-test-token",
  );
  await assert.rejects(store.connect(), (error) => error.status === 401);
});

// GitHubとの境界を模擬し、単一JSONへの保存と競合を検証する。
function remote({
  conflict = false,
  tokenValid = true,
  loseResponse = false,
} = {}) {
  let head = "head-1";
  let writes = 0;
  const files = {
    [GARUPA_STATE_PATH]: { nextId: 820, updatedAt: "2026-09-17T00:00:00Z" },
    [GARUPA_SONGS_PATH]: { groups: [] },
  };
  let proposed;
  const calls = [];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const fetcher = async (url, options) => {
    assert.ok(
      url.startsWith("https://api.github.com/repos/test-owner/song-atlas"),
    );
    assert.equal(options.headers.Authorization, "Bearer test-token");
    const route = url.replace(
      "https://api.github.com/repos/test-owner/song-atlas",
      "",
    );
    const body = options.body && JSON.parse(options.body);
    calls.push({ route, method: options.method, body });
    if (!tokenValid) return json({}, 401);
    if (options.method === "GET") {
      if (route === "") return json({ permissions: { push: true } });
      if (route.startsWith("/git/ref/")) return json({ object: { sha: head } });
      if (route.startsWith("/git/commits/"))
        return json({ tree: { sha: "tree-1" } });
      if (route.startsWith("/git/trees/"))
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
    }
    if (route === "/git/trees") {
      proposed = body;
      return json({ sha: "new-tree" });
    }
    if (route === "/git/commits") {
      assert.deepEqual(body.parents, [head]);
      assert.equal(body.tree, "new-tree");
      return json({ sha: "new-head" });
    }
    if (route.startsWith("/git/refs/")) {
      assert.equal(body.force, false);
      if (conflict) return json({}, 422);
      for (const entry of proposed.tree)
        files[entry.path] = JSON.parse(entry.content);
      head = "new-head";
      writes++;
      if (loseResponse && writes === 1)
        throw new Error("Response lost after commit");
      return json({ object: { sha: head } });
    }
    throw new Error(`Unhandled mock request ${route}`);
  };
  return {
    fetcher,
    files,
    calls,
    get writes() {
      return writes;
    },
  };
}

const client = (server) =>
  new GitHubStore(
    { owner: "test-owner", repo: "song-atlas", branch: "main" },
    "test-token",
    server.fetcher,
  );

function seedSong(server, song) {
  let group = server.files[GARUPA_SONGS_PATH].groups.find(
    (item) => item.band === song.band && item.category === song.category,
  );
  if (!group) {
    group = { band: song.band, category: song.category, songs: [] };
    server.files[GARUPA_SONGS_PATH].groups.push(group);
  }
  const { band, category, ...entry } = song;
  group.songs.push(entry);
}

const storedSong = (server, id) =>
  findGarupaSong(server.files[GARUPA_SONGS_PATH], id)?.song;

test("authenticated save stores a song and next ID in one commit", async () => {
  const server = remote();
  const store = client(server);
  await store.connect();
  const result = await store.addSong(draft, submissionId);
  assert.equal(result.id, 820);
  for (const key of ["bpm", "bpmMin", "bpmMax", "durationSeconds"])
    assert.equal(storedSong(server, 820)[key], draft[key]);
  assert.equal(storedSong(server, 820).originalWork, "架空の作品");
  assert.equal(result.editing.id, 820);
  assert.equal(result.editing.version, JSON.stringify(storedSong(server, 820)));
  assert.equal(server.files[GARUPA_STATE_PATH].nextId, 821);
  assert.equal(server.writes, 1);
  assert.equal(
    server.calls.find((x) => x.route === "/git/trees").body.tree.length,
    2,
  );
  assert.ok(!JSON.stringify(server.files).includes("test-token"));
});

test("a newly added song can be corrected without creating a duplicate", async () => {
  const server = remote();
  const store = client(server);
  const added = await store.addSong(draft, submissionId);
  const corrected = await store.updateSong(
    { ...draft, title: "修正した新曲" },
    added.editing,
    "correct-added-song-00001",
  );
  assert.equal(corrected.id, added.id);
  assert.equal(storedSong(server, added.id).title, "修正した新曲");
  assert.equal(server.files[GARUPA_STATE_PATH].nextId, 821);
  assert.equal(server.files[GARUPA_SONGS_PATH].groups[0].songs.length, 1);
});

test("retry after lost response does not create another song", async () => {
  const server = remote({ loseResponse: true });
  const store = client(server);
  await assert.rejects(store.addSong(draft, submissionId), /通信/);
  const result = await store.addSong(draft, submissionId);
  assert.equal(result.alreadySaved, true);
  assert.equal(result.editing.id, result.id);
  assert.equal(server.writes, 1);
  assert.equal(server.files[GARUPA_SONGS_PATH].groups[0].songs.length, 1);
});

test("concurrent branch update does not overwrite the collection", async () => {
  const server = remote({ conflict: true });
  await assert.rejects(client(server).addSong(draft, submissionId), /同時更新/);
  assert.equal(server.writes, 0);
  assert.equal(server.files[GARUPA_STATE_PATH].nextId, 820);
  assert.deepEqual(server.files[GARUPA_SONGS_PATH].groups, []);
});

test("invalid authentication and malformed input do not write", async () => {
  const denied = remote({ tokenValid: false });
  await assert.rejects(client(denied).connect(), /認証/);
  const healthy = remote();
  await assert.rejects(
    client(healthy).addSong({ ...draft, reading: "" }, submissionId),
    /reading/,
  );
  assert.equal(healthy.calls.length, 0);
  assert.throws(
    () =>
      validateSong({
        ...draft,
        difficulties: { ...draft.difficulties, EASY: { level: 5, notes: 0 } },
      }),
    /ノーツ/,
  );
});

test("GitHub Pages subdirectory is preserved in links", () => {
  const data = JSON.parse(fs.readFileSync("dist/songs.json"));
  assert.ok(
    renderList(data, new URLSearchParams(), "/song-atlas/").includes(
      'href="/song-atlas/garupa/songs/',
    ),
  );
  assert.ok(
    renderDetail(
      data.songs[0],
      data,
      new URLSearchParams(),
      "/song-atlas/",
    ).includes('href="/song-atlas/garupa/songs/?'),
  );
});

test("existing IDs precede the next allocated ID", () => {
  const data = JSON.parse(fs.readFileSync("dist/songs.json"));
  const state = JSON.parse(fs.readFileSync(GARUPA_STATE_PATH));
  assert.ok(data.songs.every((song) => song.id < state.nextId));
  validateSong(draft);
  const html = renderDetail(
    { ...data.songs[0], type: "anime", artist: null, composer: null },
    data,
  );
  assert.ok(html.includes("未確認"));
});

test("GitHub blob reader accepts the full 797-song source", async () => {
  const server = remote();
  server.files[GARUPA_SONGS_PATH] = JSON.parse(
    fs.readFileSync(GARUPA_SONGS_PATH, "utf8"),
  );
  const options = await client(server).listSongs();
  assert.equal(options.length, 797);
  assert.ok(
    options.some((song) => song.id === 822 && song.title === "ライムライト"),
  );
});

test("edit preserves ID, unknown fields, and unrelated songs", async () => {
  const server = remote();
  seedSong(server, { ...draft, id: 7, customMetadata: { retained: true } });
  const store = client(server);
  assert.deepEqual(
    (await store.listSongs()).map((song) => song.id),
    [7],
  );
  const loaded = await store.loadSong(7);
  seedSong(server, { ...draft, id: 8, title: "別の曲" });
  const changes = {
    ...draft,
    id: 999,
    title: "変更した曲名",
    reading: "ヘンコウ",
    category: "エクストラ",
    band: "MyGO!!!!!×ゲスト",
    composer: "作曲者",
    bpm: 174,
    durationSeconds: 125,
    difficulties: { ...draft.difficulties, SPECIAL: { level: 28, notes: 999 } },
  };
  const result = await store.updateSong(
    changes,
    loaded,
    "update-operation-00001",
  );
  assert.equal(result.id, 7);
  assert.equal(storedSong(server, 7).title, changes.title);
  assert.equal(storedSong(server, 7).band, changes.band);
  assert.deepEqual(storedSong(server, 7).customMetadata, { retained: true });
  assert.equal(storedSong(server, 8).title, "別の曲");
  assert.equal(server.files[GARUPA_STATE_PATH].nextId, 820);
  await store.updateSong(
    { ...changes, composer: "再修正" },
    result.editing,
    "update-operation-00002",
  );
  assert.equal(storedSong(server, 7).composer, "再修正");
  assert.equal(server.writes, 2);
});

test("stale, removed, or other repository edits cannot overwrite data", async () => {
  const server = remote();
  seedSong(server, { ...draft, id: 7 });
  const store = client(server);
  const loaded = await store.loadSong(7);
  server.files[GARUPA_SONGS_PATH].groups[0].songs[0].composer = "他端末の修正";
  await assert.rejects(
    store.updateSong(draft, loaded, "update-operation-00001"),
    /読み込み後/,
  );
  await assert.rejects(
    store.updateSong(
      draft,
      { ...loaded, settings: { ...loaded.settings, branch: "other" } },
      "update-operation-00001",
    ),
    /保存先/,
  );
  server.files[GARUPA_SONGS_PATH].groups[0].songs.length = 0;
  await assert.rejects(
    store.updateSong(draft, loaded, "update-operation-00001"),
    /見つかりません/,
  );
  assert.equal(server.writes, 0);
});

test("edit retry recovers a lost response", async () => {
  const server = remote({ loseResponse: true });
  seedSong(server, { ...draft, id: 7 });
  const store = client(server);
  const loaded = await store.loadSong(7);
  await assert.rejects(
    store.updateSong(
      { ...draft, composer: "修正" },
      loaded,
      "update-operation-00001",
    ),
    /通信/,
  );
  const recovered = await store.updateSong(
    { ...draft, composer: "修正" },
    loaded,
    "update-operation-00001",
  );
  assert.equal(recovered.alreadySaved, true);
  assert.equal(server.writes, 1);
  assert.equal(storedSong(server, 7).composer, "修正");
});
