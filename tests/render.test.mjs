import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderList, renderDetail } from "../dist/views.js";
const data = JSON.parse(fs.readFileSync("dist/songs.json", "utf8"));
test("search query and metadata cannot inject HTML", () => {
  const html = renderList(
    data,
    new URLSearchParams({ q: "<img src=x onerror=alert(1)>" }),
  );
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  const song = { ...data.songs[0], title: "<script>alert(1)</script>" };
  assert.ok(!renderDetail(song, data).includes("<script>alert(1)</script>"));
});
test("direct detail pages render song facts without JavaScript execution", () => {
  for (const song of data.songs) {
    const html = fs.readFileSync(`dist/songs/${song.slug}/index.html`, "utf8");
    assert.ok(html.includes("難易度・ノーツ数"));
    assert.ok(html.includes('name="q"'));
    assert.ok(html.includes("原曲") || song.type === "normal");
    assert.ok(!html.includes("楽曲データを読み込んでいます"));
  }
});
test("source-work searches return a title link and absent terms have empty state", () => {
  const html = renderList(data, new URLSearchParams({ q: "グレンラガン" }));
  assert.ok(html.includes("空色デイズ"));
  assert.ok(html.includes("/songs/" + encodeURIComponent("空色デイズ") + "/"));
  assert.ok(
    renderList(
      data,
      new URLSearchParams({ q: "xxno-match-928384xx" }),
    ).includes("一致する楽曲はありません"),
  );
});
test("out-of-range pages are bounded and all five difficulty options exist", () => {
  const html = renderList(data, new URLSearchParams({ page: "9999999" }));
  assert.ok(html.includes('id="next" disabled'));
  assert.ok(!html.includes("9999999 /"));
  assert.ok(html.includes('id="difficulty"'));
  for (let i = 0; i < 5; i++) assert.ok(html.includes(`value="${i}"`));
});
