const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja");

export function parseRelatedReferences(value) {
  try {
    const references = JSON.parse(value);
    if (
      Array.isArray(references) &&
      references.every((reference) => typeof reference === "string")
    )
      return references;
  } catch {
    // 旧バージョンのテキスト欄で保存した下書きは改行区切り。
  }
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function searchRelatedSongs(
  songs,
  { gameId, query, currentGameId, currentId, selectedReferences },
) {
  const needle = normalize(query.trim());
  const selected = new Set(selectedReferences);
  return songs.filter(
    (song) =>
      !(gameId === currentGameId && song.id === currentId) &&
      !selected.has(`${gameId}:${song.id}`) &&
      normalize(`${song.title} ${song.reading} ${song.band}`).includes(needle),
  );
}
