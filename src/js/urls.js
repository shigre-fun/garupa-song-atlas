// ESモジュールの配置先を使うため、GitHub Pagesの /リポジトリ名/ にも対応する。
export const siteBase =
  typeof document === "undefined"
    ? "/"
    : new URL(".", import.meta.url).pathname;
export function siteURL(relative, base = siteBase) {
  return base + relative.replace(/^\//, "");
}
export const gamePath = (game) => `${game.slug}/`;
export const songListPath = (game) => `${gamePath(game)}songs/`;
export const songPath = (game, stableSongId) =>
  `${songListPath(game)}${encodeURIComponent(stableSongId)}/`;
export function absoluteURL(relative, settings) {
  return settings.origin + siteURL(relative, settings.basePath);
}
