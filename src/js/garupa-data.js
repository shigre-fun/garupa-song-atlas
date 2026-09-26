import { categoryCodes, validateSong } from "./song-schema.js";

export const GARUPA_SONGS_PATH = "data/garupa/songs.json";
export const GARUPA_STATE_PATH = "data/garupa/admin-state.json";
export const GARUPA_LEGACY_PATH = "data/garupa/legacy-song-paths.json";

export function listGarupaSongs(
  data,
  game = "garupa",
  { validate = true } = {},
) {
  if (!data || !Array.isArray(data.groups))
    throw new Error("ガルパの楽曲データにはgroupsが必要です。");
  const ids = new Set();
  const groupKeys = new Set();
  const songs = [];
  for (const group of data.groups) {
    if (
      !group ||
      typeof group.band !== "string" ||
      !group.band.trim() ||
      !Object.hasOwn(categoryCodes, group.category) ||
      !Array.isArray(group.songs)
    )
      throw new Error("ガルパの楽曲グループが不正です。");
    const groupKey = JSON.stringify([group.band, group.category]);
    if (groupKeys.has(groupKey))
      throw new Error(
        `楽曲グループが重複しています: ${group.band} / ${group.category}`,
      );
    groupKeys.add(groupKey);
    for (const entry of group.songs) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        throw new Error("ガルパの楽曲データが不正です。");
      if (Object.hasOwn(entry, "band") || Object.hasOwn(entry, "category"))
        throw new Error(
          `曲${entry.id}のバンド・種類はグループ側に入力してください。`,
        );
      const song = { ...entry, band: group.band, category: group.category };
      if (validate) validateSong(song, game);
      else if (
        !Number.isSafeInteger(song.id) ||
        song.id < 1 ||
        typeof song.title !== "string" ||
        !song.title.trim() ||
        typeof song.reading !== "string"
      )
        throw new Error(`曲${song.id}の一覧表示に必要な情報が不正です。`);
      if (ids.has(song.id))
        throw new Error(`楽曲IDが重複しています: ${song.id}`);
      ids.add(song.id);
      songs.push(song);
    }
  }
  return songs;
}

export function findGarupaSong(data, id) {
  for (const group of data.groups) {
    const index = group.songs.findIndex((song) => song.id === id);
    if (index !== -1)
      return {
        group,
        index,
        song: {
          ...group.songs[index],
          band: group.band,
          category: group.category,
        },
      };
  }
  return null;
}

function insert(data, song) {
  let group = data.groups.find(
    (entry) => entry.band === song.band && entry.category === song.category,
  );
  if (!group) {
    group = { band: song.band, category: song.category, songs: [] };
    data.groups.push(group);
  }
  const { band, category, ...entry } = song;
  group.songs.push(entry);
}

export function addGarupaSong(data, song, game = "garupa") {
  validateSong(song, game);
  if (findGarupaSong(data, song.id))
    throw new Error(`楽曲IDが重複しています: ${song.id}`);
  insert(data, song);
}

export function updateGarupaSong(data, song, game = "garupa") {
  validateSong(song, game);
  const current = findGarupaSong(data, song.id);
  if (!current) throw new Error(`楽曲IDが見つかりません: ${song.id}`);
  if (
    current.group.band === song.band &&
    current.group.category === song.category
  ) {
    const { band, category, ...entry } = song;
    current.group.songs[current.index] = entry;
    return;
  }
  current.group.songs.splice(current.index, 1);
  if (!current.group.songs.length)
    data.groups.splice(data.groups.indexOf(current.group), 1);
  insert(data, song);
}
