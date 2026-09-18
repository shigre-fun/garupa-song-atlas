import fs from "node:fs";
import path from "node:path";

import {
  difficultyNames,
  categoryCodes,
  folderName,
  validateSong,
} from "../src/song-schema.js";
export { difficultyNames, categoryCodes, folderName };

export function loadCatalog(directory = "data/songs") {
  const names = fs.readdirSync(directory).sort();
  const ids = new Set();
  const folded = new Set();
  return names.map((slug) => {
    const file = path.join(directory, slug, "song.json");
    const song = JSON.parse(fs.readFileSync(file, "utf8"));
    const fail = (message) => {
      throw new Error(`${file}: ${message}`);
    };
    try {
      validateSong(song, slug);
    } catch (error) {
      fail(error.message);
    }
    if (folded.has(slug.toLowerCase()))
      fail("大文字・小文字だけ異なるフォルダーがあります。");
    folded.add(slug.toLowerCase());
    if (ids.has(song.id)) fail("idが重複しています。");
    ids.add(song.id);
    const charts = difficultyNames.map((name) => song.difficulties[name]);
    return {
      id: song.id,
      slug,
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
