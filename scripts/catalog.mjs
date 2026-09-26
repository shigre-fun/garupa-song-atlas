import fs from "node:fs";
import { GAMES } from "../src/js/site-config.js";
import { listGarupaSongs } from "../src/js/garupa-data.js";

import { difficultyNames, categoryCodes } from "../src/js/song-schema.js";
export { difficultyNames, categoryCodes };

/** @typedef {{ gameId: string, stableSongId: string, id: number, slug: string, title: string, reading: string, band: string, type: string, publishedAt: number | null, seq: number, composer: string | null, artist: string | null, work: string | null, live3d: boolean | null, mv: boolean | null, relatedSongIds: string[], bpm: number | null, bpmMin: number | null, bpmMax: number | null, durationSeconds: number | null, aliases: string[], difficulties: Array<{level: number, notes: number} | null> }} Song */

export function loadCatalog(file = GAMES.garupa.dataFile, game = GAMES.garupa) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let songs;
  try {
    songs = listGarupaSongs(data, game.id);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  return songs.map((song) => {
    const charts = game.difficulties.map((name) => song.difficulties[name]);
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
      mv: song.mv ?? null,
      relatedSongIds: song.relatedSongIds ?? [],
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
  return loadCatalog(game.dataFile, game);
}
