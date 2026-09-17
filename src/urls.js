// ESモジュールの配置先を使うため、GitHub Pagesの /リポジトリ名/ にも対応する。
export const siteBase =
  typeof document === "undefined"
    ? "/"
    : new URL(".", import.meta.url).pathname;
export function siteURL(relative, base = siteBase) {
  return base + relative.replace(/^\//, "");
}
