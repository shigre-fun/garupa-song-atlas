// 手動ブラウザーテスト専用。保存先はメモリーのみ。実GitHubへの通信はしない。
// 先にSITE_BASE_PATH=/garupa-song-atlasでbuildし、node tests/editor-preview.mjs。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { findGarupaSong, listGarupaSongs } from "../src/js/garupa-data.js";
// 別ポートなら過去の検証用下書きと分離できる。
const port = Number(process.env.EDITOR_PREVIEW_PORT || 4174);
const origin = `http://127.0.0.1:${port}`;
const files = {
  "data/garupa/admin-state.json": {
    nextId: 900,
    updatedAt: "2026-09-18T00:00:00Z",
  },
  "data/garupa/songs.json": { groups: [] },
  "data/ournotes/admin-state.json": {
    nextId: 900,
    updatedAt: "2026-09-25T00:00:00Z",
  },
  "data/ournotes/songs.json": { groups: [] },
};
const source = JSON.parse(fs.readFileSync("data/garupa/songs.json", "utf8"));
for (const title of ["空色デイズ", "ときめきエクスペリエンス！"]) {
  const id = listGarupaSongs(source).find((song) => song.title === title)?.id;
  const found = findGarupaSong(source, id);
  if (!found) throw new Error(`検証用の${title}が見つかりません。`);
  let group = files["data/garupa/songs.json"].groups.find(
    (item) =>
      item.band === found.group.band && item.category === found.group.category,
  );
  if (!group) {
    group = {
      band: found.group.band,
      category: found.group.category,
      songs: [],
    };
    files["data/garupa/songs.json"].groups.push(group);
  }
  group.songs.push(found.group.songs[found.index]);
}
const ournotesSource = JSON.parse(
  fs.readFileSync("data/ournotes/songs.json", "utf8"),
);
for (const title of ["迷星叫", "春日影（MyGO!!!!! ver.）"]) {
  const id = listGarupaSongs(ournotesSource, "ournotes").find(
    (song) => song.title === title,
  )?.id;
  const found = findGarupaSong(ournotesSource, id);
  if (!found) throw new Error(`検証用の${title}が見つかりません。`);
  let group = files["data/ournotes/songs.json"].groups.find(
    (item) =>
      item.band === found.group.band && item.category === found.group.category,
  );
  if (!group) {
    group = {
      band: found.group.band,
      category: found.group.category,
      songs: [],
    };
    files["data/ournotes/songs.json"].groups.push(group);
  }
  group.songs.push(found.group.songs[found.index]);
}
let head = "initial",
  proposed,
  count = 0;
const root = path.resolve("dist");
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const pathname = decodeURIComponent(url.pathname);
    const json = (body, code = 200) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (pathname === "/_fixture/state") return json({ head, count, files });
    if (pathname.startsWith("/repos/")) {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      const route = pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "");
      if (req.method === "GET") {
        if (!route) return json({ permissions: { push: true } });
        if (route.startsWith("/git/ref/"))
          return json({ object: { sha: head } });
        if (route.startsWith("/git/commits/"))
          return json({ tree: { sha: "tree" } });
        if (route.startsWith("/git/trees/"))
          return json({
            tree: [
              { path: "scripts/build.mjs", type: "blob", sha: "build" },
              ...Object.keys(files).map((name, i) => ({
                path: name,
                type: "blob",
                sha: `blob-${i}`,
              })),
            ],
          });
        if (route.startsWith("/git/blobs/")) {
          const content = JSON.stringify(
            Object.values(files)[Number(route.split("blob-")[1])],
          );
          return json({
            encoding: "base64",
            size: Buffer.byteLength(content),
            content: Buffer.from(content).toString("base64"),
          });
        }
      }
      if (route === "/git/trees") {
        proposed = body;
        return json({ sha: "new-tree" });
      }
      if (route === "/git/commits") return json({ sha: `commit-${count + 1}` });
      if (route.startsWith("/git/refs/")) {
        for (const entry of proposed.tree)
          files[entry.path] = JSON.parse(entry.content);
        head = body.sha;
        count++;
        return json({ object: { sha: head } });
      }
      return json({ error: "Unknown fixture endpoint" }, 404);
    }
    let relative = pathname.replace(/^\/garupa-song-atlas\//, "/");
    if (relative.endsWith("/")) relative += "index.html";
    if (relative === "/admin-config.json")
      return json({
        owner: "fixture-owner",
        repo: "editor-fixture",
        branch: "main",
      });
    const file = path.resolve(root, "." + relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
      return json({}, 404);
    const mime = {
      ".js": "text/javascript",
      ".html": "text/html",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };
    res.writeHead(200, {
      "Content-Type": `${mime[path.extname(file)] || "text/plain"}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    let content = fs.readFileSync(file, "utf8");
    if (relative === "/github-store.js")
      content = content.replace("https://api.github.com", origin);
    res.end(content);
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`${origin}/garupa-song-atlas/admin/ (memory-only fixture)`),
  );
