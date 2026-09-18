import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filteredSongs, pageNumbers, bandOrder } from "../src/domain.js";
import { renderList, renderDetail } from "../src/views.js";
const data = JSON.parse(fs.readFileSync("dist/songs.json", "utf8"));
test("multiple types OR and multiple bands OR combine with AND", () => {
  const params = new URLSearchParams("type=anime&type=tie_up&band=0&band=1");
  const expected = data.songs.filter(
    (s) =>
      ["anime", "tie_up"].includes(s.type) && [0, 1].includes(bandOrder(s)),
  );
  assert.ok(expected.length > 0);
  assert.deepEqual(filteredSongs(data.songs, params), expected);
  params.set("q", "グレンラガン");
  assert.deepEqual(
    filteredSongs(data.songs, params).map((s) => s.title),
    ["空色デイズ"],
  );
  assert.equal(
    filteredSongs(data.songs, new URLSearchParams()).length,
    data.songs.length,
  );
  assert.equal(
    filteredSongs(data.songs, new URLSearchParams("type=invalid&band=999"))
      .length,
    data.songs.length,
  );
  assert.equal(
    filteredSongs(
      data.songs,
      new URLSearchParams("q=xxnonexistentxx&type=anime"),
    ).length,
    0,
  );
});
test("page number windows include ends, neighbors and omission marks", () => {
  assert.deepEqual(pageNumbers(5, 16), [1, null, 3, 4, 5, 6, 7, null, 16]);
  assert.deepEqual(pageNumbers(1, 16), [1, 2, 3, null, 16]);
  assert.deepEqual(pageNumbers(16, 16), [1, null, 14, 15, 16]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
});
test("filter state survives page links, details and back links with escaped attributes", () => {
  const p = new URLSearchParams(
    "type=anime&type=tie_up&band=0&band=1&page=2&sort=release",
  );
  const html = renderList(data, p, "/garupa-song-atlas/");
  assert.ok(html.includes('name="type" value="anime" checked'));
  assert.ok(html.includes('name="band" value="1" checked'));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  for (const href of hrefs.filter((h) => h.includes("?"))) {
    const q = new URL(href, "https://example.test").searchParams;
    assert.deepEqual(q.getAll("type"), ["anime", "tie_up"]);
    assert.deepEqual(q.getAll("band"), ["0", "1"]);
    assert.equal(q.get("sort"), "release");
  }
  const detail = renderDetail(data.songs[0], data, p, "/garupa-song-atlas/");
  assert.ok(
    detail.includes(
      'href="/garupa-song-atlas/?type=anime&amp;type=tie_up&amp;band=0&amp;band=1&amp;page=2&amp;sort=release"',
    ),
  );
  const single = renderList(
    data,
    new URLSearchParams("q=グレンラガン&type=anime&page=999"),
  );
  assert.ok(single.includes('id="prev" disabled'));
  assert.ok(single.includes('id="next" disabled'));
  assert.ok(single.includes('aria-current="page"'));
});
