// 譜面版の表記だけを外す。曲名中の作品名や副題は残す。
export function baseSongTitle(title) {
  return title
    .replace(/^\[FULL\]\s*/i, "")
    .replace(/\s*[（(](?:3Dライブモード対応|[^（）()]*ver\.)[）)]$/i, "")
    .trim();
}

export function relatedSongs(song, catalogs) {
  const title = baseSongTitle(song.title);
  const reference = `${song.gameId}:${song.id}`;
  return Object.values(catalogs)
    .flat()
    .filter(
      (candidate) =>
        !(
          candidate.gameId === song.gameId &&
          candidate.stableSongId === song.stableSongId
        ) &&
        ((song.relatedSongIds ?? []).includes(
          `${candidate.gameId}:${candidate.id}`,
        ) ||
          (candidate.relatedSongIds ?? []).includes(reference) ||
          (baseSongTitle(candidate.title) === title &&
            // 同名異曲を結ばない。現在の共通収録曲は作曲者も一致する。
            song.composer &&
            candidate.composer &&
            song.composer === candidate.composer)),
    )
    .sort(
      (a, b) =>
        (a.gameId === song.gameId ? 0 : 1) -
          (b.gameId === song.gameId ? 0 : 1) || a.id - b.id,
    );
}

export function validateRelatedSongIds(catalogs) {
  const songs = Object.values(catalogs).flat();
  const byReference = new Map(
    songs.map((song) => [`${song.gameId}:${song.id}`, song]),
  );
  for (const song of songs) {
    const source = `${song.gameId}:${song.id}`;
    for (const reference of song.relatedSongIds ?? []) {
      const target = byReference.get(reference);
      if (!target || source === reference)
        throw new Error(`${source} の関連楽曲 ${reference} が不正です。`);
      if (!(target.relatedSongIds ?? []).includes(source))
        throw new Error(
          `${source} と ${reference} の関連楽曲を相互に設定してください。`,
        );
    }
  }
}
