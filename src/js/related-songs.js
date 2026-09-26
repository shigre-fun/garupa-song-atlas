export function relatedSongs(song, catalogs) {
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
          (candidate.relatedSongIds ?? []).includes(reference)),
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
