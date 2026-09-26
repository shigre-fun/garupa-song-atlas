import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRelatedReferences,
  searchRelatedSongs,
} from "../src/js/related-song-picker.js";

test("related links keep existing drafts and saved references", () => {
  assert.deepEqual(parseRelatedReferences('["garupa:667","ournotes:7"]'), [
    "garupa:667",
    "ournotes:7",
  ]);
  assert.deepEqual(parseRelatedReferences("garupa:667\nournotes:7\n"), [
    "garupa:667",
    "ournotes:7",
  ]);
  assert.deepEqual(parseRelatedReferences(""), []);
});

test("related song search uses title, reading and band, omitting self and selected songs", () => {
  const songs = [
    {
      id: 7,
      title: "春日影（MyGO!!!!! ver.）",
      reading: "ハルヒカゲ",
      band: "MyGO!!!!!",
    },
    { id: 8, title: "another song", reading: "アナザー", band: "Ave Mujica" },
  ];
  const filter = (gameId, query, selectedReferences = []) =>
    searchRelatedSongs(songs, {
      gameId,
      query,
      currentGameId: "ournotes",
      currentId: 7,
      selectedReferences,
    }).map((song) => song.id);
  assert.deepEqual(filter("garupa", "春日影"), [7]);
  assert.deepEqual(filter("ournotes", "春日影"), []);
  assert.deepEqual(filter("garupa", "ハルヒカゲ"), [7]);
  assert.deepEqual(filter("garupa", "ＡＶＥ ｍｕｊｉｃａ"), [8]);
  assert.deepEqual(filter("garupa", "春日影", ["garupa:7"]), []);
  assert.deepEqual(filter("ournotes", "アナザー"), [8]);
});
