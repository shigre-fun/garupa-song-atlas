import fs from "node:fs";
import { GAMES } from "../src/js/site-config.js";
import { listGarupaSongs } from "../src/js/garupa-data.js";

import { difficultyNames, categoryCodes } from "../src/js/song-schema.js";
export { difficultyNames, categoryCodes };

/** @typedef {{ gameId: string, stableSongId: string, id: number, slug: string, title: string, reading: string, band: string, type: string, publishedAt: number | null, seq: number, composer: string | null, artist: string | null, work: string | null, live3d: boolean | null, bpm: number | null, bpmMin: number | null, bpmMax: number | null, durationSeconds: number | null, aliases: string[], difficulties: Array<{level: number, notes: number} | null>, sourceURL?: string }} Song */

export function loadCatalog(file = GAMES.garupa.dataFile, game = GAMES.garupa) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let songs;
  try {
    songs = listGarupaSongs(data);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  return songs.map((song) => {
    const charts = difficultyNames.map((name) => song.difficulties[name]);
    return {
      gameId: game.id,
      stableSongId: String(song.id),
      id: song.id,
      slug: String(song.id),
      revision: song.revision || song.submissionId || null,
      title: song.title,
      reading: song.reading,
      band: song.band,
      type: categoryCodes[song.category],
      publishedAt: Date.parse(song.releaseDate),
      seq: song.releaseOrder ?? song.id,
      composer: song.composer,
      artist: song.originalArtist,
      work: song.originalWork,
      live3d: song.live3d,
      bpm: song.bpm ?? null,
      bpmMin: song.bpmMin ?? null,
      bpmMax: song.bpmMax ?? null,
      durationSeconds: song.durationSeconds ?? null,
      aliases: song.aliases,
      difficulties: charts,
    };
  });
}

export function loadGameCatalog(game) {
  if (game.id === "garupa") return loadCatalog(game.dataFile, game);
  if (!game.dataFile) return [];
  const data = JSON.parse(fs.readFileSync(game.dataFile, "utf8"));
  if (!Array.isArray(data.groups))
    throw new Error(`${game.dataFile}: groupsが必要です。`);
  const ids = new Set();
  const songs = [];
  for (const group of data.groups) {
    if (
      !group.band ||
      !Object.hasOwn(categoryCodes, group.category) ||
      !/^https:\/\//.test(group.sourceURL) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(group.availableFrom) ||
      !Number.isFinite(Date.parse(`${group.availableFrom}T00:00:00+09:00`)) ||
      !Array.isArray(group.songs)
    )
      throw new Error(`${game.dataFile}: 楽曲グループが不正です。`);
    for (const [id, title] of group.songs) {
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        ids.has(id) ||
        typeof title !== "string" ||
        !title.trim()
      )
        throw new Error(`${game.dataFile}: IDまたは曲名が不正です: ${id}`);
      ids.add(id);
      songs.push({
        gameId: game.id,
        stableSongId: String(id),
        id,
        slug: String(id),
        title,
        reading: "",
        band: group.band,
        type: categoryCodes[group.category],
        publishedAt: Date.parse(`${group.availableFrom}T00:00:00+09:00`),
        seq: id,
        composer: null,
        artist: null,
        work: null,
        live3d: null,
        bpm: null,
        bpmMin: null,
        bpmMax: null,
        durationSeconds: null,
        aliases: [],
        difficulties: [],
        sourceURL: group.sourceURL,
      });
    }
  }
  return songs;
}
