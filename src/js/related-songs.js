// 譜面版の表記だけを外す。曲名中の作品名や副題は残す。
export function baseSongTitle(title) {
  return title
    .replace(/^\[FULL\]\s*/i, "")
    .replace(/\s*[（(](?:3Dライブモード対応|[^（）()]*ver\.)[）)]$/i, "")
    .trim();
}

export function relatedSongs(song, catalogs) {
  const title = baseSongTitle(song.title);
  return Object.values(catalogs)
    .flat()
    .filter(
      (candidate) =>
        !(
          candidate.gameId === song.gameId &&
          candidate.stableSongId === song.stableSongId
        ) &&
        baseSongTitle(candidate.title) === title &&
        // 同名異曲を結ばない。現在の共通収録曲は作曲者も一致する。
        song.composer &&
        candidate.composer &&
        song.composer === candidate.composer,
    )
    .sort(
      (a, b) =>
        (a.gameId === song.gameId ? 0 : 1) -
          (b.gameId === song.gameId ? 0 : 1) || a.id - b.id,
    );
}
