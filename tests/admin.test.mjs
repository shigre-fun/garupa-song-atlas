import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GitHubStore } from "../src/github-store.js";
import { validateSong } from "../src/song-schema.js";
import { renderDetail, renderList } from "../src/views.js";

const submissionId = "test-submission-00000001";

test("default browser fetch uses the global receiver", async (t) => {
  // ブラウザーのfetchはGitHubStoreをthisとして呼ぶとIllegal invocationになる。
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
  durationSeconds: 105.384,
  aliases: [],
  difficulties: {
    EASY: { level: 5, notes: 100 },
    NORMAL: { level: 10, notes: 200 },
    HARD: { level: 20, notes: 500 },
    EXPERT: { level: 26, notes: 800 },
    SPECIAL: null,
  },
};

// GitHubとの境界を模擬し、通信内容・永続化・競合動作を検証する。
function remote({
  conflict = false,
  tokenValid = true,
  loseResponse = false,
} = {}) {
  let head = "head-1";
  let writes = 0;
  let files = {
    "data/admin-state.json": { nextId: 820, updatedAt: "2026-09-17T00:00:00Z" },
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
        return json({
          encoding: "base64",
          size: JSON.stringify(file).length,
          content: Buffer.from(JSON.stringify(file)).toString("base64"),
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
    calls,
    get files() {
      return files;
    },
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

test("authenticated save atomically stores Japanese song data and next ID", async () => {
  const server = remote();
  const store = client(server);
  await store.connect();
  const result = await store.addSong(draft, draft.title, submissionId);
  assert.equal(result.id, 820);
  for (const key of ["bpm", "bpmMin", "bpmMax", "durationSeconds"])
    assert.equal(
      server.files["data/songs/テストの新曲/song.json"][key],
      draft[key],
    );
  assert.equal(
    server.files["data/songs/テストの新曲/song.json"].originalWork,
    "架空の作品",
  );
  assert.equal(server.files["data/admin-state.json"].nextId, 821);
  assert.equal(server.writes, 1);
  assert.equal(
    server.calls.find((x) => x.route === "/git/trees" && x.method === "POST")
      .body.tree.length,
    2,
  );
  assert.ok(!JSON.stringify(server.files).includes("test-token"));
});
test("retry after lost save response does not create another song", async () => {
  const server = remote({ loseResponse: true });
  const store = client(server);
  await assert.rejects(store.addSong(draft, draft.title, submissionId), /通信/);
  const result = await store.addSong(draft, draft.title, submissionId);
  assert.equal(result.alreadySaved, true);
  assert.equal(server.writes, 1);
});
test("duplicate song and concurrent branch updates never overwrite stored data", async () => {
  const server = remote();
  const store = client(server);
  await store.addSong(draft, draft.title, submissionId);
  await assert.rejects(
    store.addSong(draft, draft.title, "different-submission-002"),
    /存在/,
  );
  assert.equal(server.writes, 1);
  const concurrent = remote({ conflict: true });
  await assert.rejects(
    client(concurrent).addSong(draft, draft.title, submissionId),
    /同時更新/,
  );
  assert.equal(concurrent.writes, 0);
  assert.equal(concurrent.files["data/admin-state.json"].nextId, 820);
});
test("invalid authentication and malformed input do not write", async () => {
  const server = remote({ tokenValid: false });
  await assert.rejects(client(server).connect(), /認証/);
  assert.equal(server.writes, 0);
  const healthy = remote();
  await assert.rejects(
    client(healthy).addSong(
      { ...draft, reading: "" },
      draft.title,
      submissionId,
    ),
    /reading/,
  );
  assert.equal(healthy.calls.length, 0);
  assert.throws(() => validateSong(draft, "../escape"), /フォルダー/);
  assert.throws(
    () =>
      validateSong(
        {
          ...draft,
          difficulties: { ...draft.difficulties, EASY: { level: 5, notes: 0 } },
        },
        draft.title,
      ),
    /ノーツ/,
  );
});
test("GitHub Pages subdirectory is preserved in list links and detail backlinks", () => {
  const data = JSON.parse(fs.readFileSync("dist/songs.json"));
  const html = renderList(data, new URLSearchParams(), "/song-atlas/");
  assert.ok(html.includes('href="/song-atlas/songs/'));
  assert.ok(!html.includes('href="/songs/'));
  assert.ok(
    renderDetail(
      data.songs[0],
      data,
      new URLSearchParams(),
      "/song-atlas/",
    ).includes('href="/song-atlas/?'),
  );
});
test("all existing IDs precede the next allocated ID and unknown metadata renders explicitly", () => {
  const data = JSON.parse(fs.readFileSync("dist/songs.json"));
  const state = JSON.parse(fs.readFileSync("data/admin-state.json"));
  assert.ok(data.songs.every((song) => song.id < state.nextId));
  validateSong(draft, draft.title);
  const html = renderDetail(
    { ...data.songs[0], type: "anime", artist: null, composer: null },
    data,
  );
  assert.ok(html.includes("未確認"));
});

test("edit preserves identity, unknown fields and counter while updating every song field", async () => {
  const server = remote();
  const path = `data/songs/${draft.title}/song.json`;
  server.files[path] = { ...draft, id: 7, customMetadata: { retained: true } };
  const store = client(server);
  assert.deepEqual(await store.listSongs(), [draft.title]);
  const loaded = await store.loadSong(draft.title);
  const changes = {
    ...draft,
    id: 999,
    title: "変更した曲名",
    reading: "ヘンコウ",
    bpm: 174,
    bpmMin: 100.25,
    bpmMax: 201,
    durationSeconds: 125.625,
    category: "エクストラ",
    band: "MyGO!!!!!×ゲスト",
    releaseDate: "2026-09-18T15:01+09:00",
    releaseOrder: 9,
    composer: "作曲者",
    originalArtist: "原曲歌手",
    originalWork: "作品名",
    aliases: ["別名"],
    difficulties: { ...draft.difficulties, SPECIAL: { level: 28, notes: 999 } },
  };
  const result = await store.updateSong(
    changes,
    loaded,
    "update-operation-00001",
  );
  assert.equal(server.files[path].id, 7);
  assert.equal(result.slug, draft.title);
  assert.equal(server.files[path].title, changes.title);
  for (const key of ["bpm", "bpmMin", "bpmMax", "durationSeconds"])
    assert.equal(server.files[path][key], changes[key]);
  assert.deepEqual(server.files[path].customMetadata, { retained: true });
  assert.deepEqual(server.files[path].difficulties, changes.difficulties);
  assert.equal(server.files["data/admin-state.json"].nextId, 820);
  assert.equal(server.writes, 1);
  await store.updateSong(
    { ...changes, composer: "再修正" },
    result.editing,
    "update-operation-00002",
  );
  assert.equal(server.files[path].composer, "再修正");
  assert.equal(server.writes, 2);
});

test("stale edit, removed song and different repository cannot overwrite data", async () => {
  const server = remote();
  const path = `data/songs/${draft.title}/song.json`;
  server.files[path] = { ...draft, id: 7 };
  const store = client(server);
  const loaded = await store.loadSong(draft.title);
  server.files[path].composer = "他端末の修正";
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
  delete server.files[path];
  await assert.rejects(
    store.updateSong(draft, loaded, "update-operation-00001"),
    /見つかりません/,
  );
  assert.equal(server.writes, 0);
});

test("edit retry recovers a lost response and unrelated edits are preserved", async () => {
  const server = remote({ loseResponse: true });
  const path = `data/songs/${draft.title}/song.json`;
  server.files[path] = { ...draft, id: 7 };
  const store = client(server);
  const loaded = await store.loadSong(draft.title);
  server.files["data/songs/別の曲/song.json"] = {
    ...draft,
    id: 8,
    title: "別の曲",
  };
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
  assert.equal(server.files["data/songs/別の曲/song.json"].id, 8);
  assert.equal(server.files["data/admin-state.json"].nextId, 820);
});

test("edit refuses a branch race during commit without advancing the counter", async () => {
  const server = remote({ conflict: true });
  server.files[`data/songs/${draft.title}/song.json`] = { ...draft, id: 7 };
  const store = client(server);
  const loaded = await store.loadSong(draft.title);
  await assert.rejects(
    store.updateSong(
      { ...draft, title: "変更" },
      loaded,
      "update-operation-00001",
    ),
    /同時更新/,
  );
  assert.equal(server.writes, 0);
  assert.equal(
    server.files[`data/songs/${draft.title}/song.json`].title,
    draft.title,
  );
});
