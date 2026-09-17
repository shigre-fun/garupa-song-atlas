export const difficulties = ["EASY", "NORMAL", "HARD", "EXPERT", "SPECIAL"];
export const typeNames = {
  normal: "オリジナル",
  anime: "カバー",
  tie_up: "エクストラ",
};
export const bandNames = [
  "Poppin'Party",
  "Afterglow",
  "Pastel＊Palettes",
  "Roselia",
  "ハロー、ハッピーワールド！",
  "Morfonica",
  "RAISE A SUILEN",
  "MyGO!!!!!",
  "Ave Mujica",
];
export const colors = [
  "#e93475",
  "#db4556",
  "#31a99e",
  "#8665bd",
  "#e2aa24",
  "#579ddd",
  "#38a0a1",
  "#448abd",
  "#a94257",
  "#79859c",
];
export function bandOrder(s) {
  const exact = bandNames.indexOf(s.band);
  if (exact >= 0) return exact;
  if (bandNames.filter((n) => s.band.includes(n)).length > 1) return 9;
  const i = bandNames.findIndex(
    (n) => s.band.startsWith(n + "×") || s.band.startsWith(n + " ×"),
  );
  return i < 0 ? 9 : i;
}
export function normalize(s) {
  return (s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}
const collator = new Intl.Collator("ja");
export function compareSongs(mode) {
  const release = (a, b) =>
    a.publishedAt - b.publishedAt ||
    (a.seq ?? a.id) - (b.seq ?? b.id) ||
    a.id - b.id;
  const band = (a, b) =>
    bandOrder(a) - bandOrder(b) ||
    ["normal", "anime", "tie_up"].indexOf(a.type) -
      ["normal", "anime", "tie_up"].indexOf(b.type) ||
    release(a, b);
  return mode === "release"
    ? release
    : mode === "kana"
      ? (a, b) =>
          collator.compare(
            normalize(a.reading || a.title),
            normalize(b.reading || b.title),
          ) || band(a, b)
      : mode.startsWith("level-")
        ? (a, b) =>
            (b.difficulties[+mode.slice(-1)]?.level ?? -1) -
              (a.difficulties[+mode.slice(-1)]?.level ?? -1) || band(a, b)
        : band;
}
export function matches(s, q) {
  const terms = normalize(q);
  return (
    !terms ||
    [s.title, s.reading, s.artist, s.work, ...(s.aliases || [])].some((v) =>
      normalize(v).includes(terms),
    )
  );
}
