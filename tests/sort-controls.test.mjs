import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareSongs,
  sortState,
  nextSortParams,
  sortLabels,
} from "../src/domain.js";
import { renderList, renderDetail } from "../src/views.js";
import { loadCatalog } from "../scripts/catalog.mjs";

test("sort state defaults to EXPERT, preserves old URLs and rejects invalid choices", () => {
  assert.deepEqual(sortState(new URLSearchParams()), {
    mode: "band",
    difficulty: 3,
    direction: "forward",
  });
  assert.deepEqual(
    sortState(new URLSearchParams("sort=level-1&direction=reverse")),
    { mode: "level", difficulty: 1, direction: "reverse" },
  );
  assert.deepEqual(
    sortState(new URLSearchParams("sort=invalid&difficulty=9&direction=bad")),
    { mode: "band", difficulty: 3, direction: "forward" },
  );
});
test("every button toggles repeatedly, other modes reset direction, repeated filters survive", () => {
  for (const mode of Object.keys(sortLabels)) {
    let params = new URLSearchParams(
      `sort=${mode === "band" ? "kana" : "band"}&difficulty=2&page=9&q=test&type=anime&type=tie_up&band=0&band=1`,
    );
    for (const direction of ["forward", "reverse", "forward"]) {
      params = nextSortParams(params, mode);
      assert.deepEqual(sortState(params), { mode, difficulty: 2, direction });
      assert.equal(params.get("page"), "1");
      assert.equal(params.get("q"), "test");
      assert.deepEqual(params.getAll("type"), ["anime", "tie_up"]);
      assert.deepEqual(params.getAll("band"), ["0", "1"]);
    }
  }
});
test("notes sorting uses each of five difficulties, reverses ties, keeps absent charts last", () => {
  const base = { band: "Poppin'Party", type: "normal", publishedAt: 0 };
  for (let difficulty = 0; difficulty < 5; difficulty++) {
    const rows = [100, 300, 200, null, 200].map((notes, index) => ({
      ...base,
      id: index + 1,
      difficulties: Array.from({ length: 5 }, (_, d) =>
        d === difficulty
          ? notes === null
            ? null
            : { notes, level: 20 }
          : { notes: 999 - index, level: 10 },
      ),
    }));
    assert.deepEqual(
      [...rows]
        .sort(compareSongs("notes", "forward", difficulty))
        .map((s) => s.id),
      [2, 3, 5, 1, 4],
    );
    assert.deepEqual(
      [...rows]
        .sort(compareSongs("notes", "reverse", difficulty))
        .map((s) => s.id),
      [1, 5, 3, 2, 4],
    );
  }
});
test("all modes reverse known songs exactly and unrelated modes ignore difficulty", () => {
  const songs = loadCatalog();
  for (const mode of Object.keys(sortLabels)) {
    for (let difficulty = 0; difficulty < 5; difficulty++) {
      const field =
        mode === "bpm" ? "bpm" : mode === "duration" ? "durationSeconds" : null;
      const known = songs.filter((s) =>
        mode === "level" || mode === "notes"
          ? s.difficulties[difficulty]?.[mode] != null
          : field
            ? s[field] != null
            : true,
      );
      const forward = [...known]
        .sort(compareSongs(mode, "forward", difficulty))
        .map((s) => s.id);
      const reverse = [...known]
        .sort(compareSongs(mode, "reverse", difficulty))
        .map((s) => s.id);
      assert.deepEqual(
        reverse,
        [...forward].reverse(),
        `${mode}/${difficulty}`,
      );
      if (!["level", "notes"].includes(mode))
        assert.deepEqual(
          forward,
          [...known].sort(compareSongs(mode, "forward", 3)).map((s) => s.id),
        );
    }
  }
});
test("seven sort buttons, default difficulty and direction are visible; state survives page/detail/back links", () => {
  const data = { songs: loadCatalog(), updatedAt: 0 };
  const initial = renderList(data);
  assert.equal((initial.match(/data-sort=/g) || []).length, 7);
  assert.ok(initial.includes('value="3" selected>EXPERT'));
  assert.ok(!/レベルが高い順|古い順|多い順|長い順|速い順/.test(initial));
  const params = new URLSearchParams(
    "sort=notes&difficulty=4&direction=reverse&type=anime&band=0",
  );
  const html = renderList(data, params);
  assert.match(html, /data-sort="notes" aria-pressed="true"/);
  assert.ok(html.includes("▼"));
  const links = [...html.matchAll(/href="([^"]+\?[^\"]+)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  for (const href of links) {
    const p = new URL(href, "https://example.test").searchParams;
    for (const k of ["sort", "difficulty", "direction", "type", "band"])
      assert.equal(p.get(k), params.get(k));
  }
  assert.ok(
    renderDetail(data.songs[0], data, params).includes(
      "difficulty=4&amp;direction=reverse",
    ),
  );
});
