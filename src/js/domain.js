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
export const sortLabels = {
  band: "バンド順",
  level: "レベル順",
  notes: "ノーツ数順",
  bpm: "BPM順",
  duration: "演奏時間順",
  kana: "楽曲名50音順",
  release: "配信順",
};
export function sortState(params) {
  const legacy = /^(level|notes)-([0-4])$/.exec(params.get("sort") || "");
  const candidate = legacy?.[1] || params.get("sort");
  return {
    mode: Object.hasOwn(sortLabels, candidate) ? candidate : "band",
    difficulty: /^[0-4]$/.test(params.get("difficulty") || "")
      ? Number(params.get("difficulty"))
      : legacy
        ? Number(legacy[2])
        : 3,
    direction: params.get("direction") === "reverse" ? "reverse" : "forward",
  };
}
export function nextSortParams(params, mode) {
  const current = sortState(params);
  const next = new URLSearchParams(params);
  next.set("sort", mode);
  next.set("difficulty", current.difficulty);
  next.set(
    "direction",
    current.mode === mode && current.direction === "forward"
      ? "reverse"
      : "forward",
  );
  next.set("page", 1);
  return next;
}
export function compareSongs(mode, direction = "forward", difficulty = 3) {
  const legacy = /^(level|notes)-([0-4])$/.exec(mode);
  if (legacy) {
    mode = legacy[1];
    difficulty = Number(legacy[2]);
  }
  const compare = defaultCompareSongs(
    mode === "level" || mode === "notes" ? `${mode}-${difficulty}` : mode,
  );
  const metric =
    mode === "level" || mode === "notes"
      ? (s) => s.difficulties[difficulty]?.[mode]
      : mode === "bpm"
        ? (s) => s.bpm
        : mode === "duration"
          ? (s) => s.durationSeconds
          : null;
  return (a, b) => {
    // 未実装・未確認は逆順でも最後に置く。
    if (metric && (metric(a) == null) !== (metric(b) == null))
      return metric(a) == null ? 1 : -1;
    return (direction === "reverse" ? -1 : 1) * compare(a, b);
  };
}
function defaultCompareSongs(mode) {
  const release = (a, b) =>
    a.publishedAt - b.publishedAt ||
    (a.seq ?? a.id) - (b.seq ?? b.id) ||
    a.id - b.id;
  const band = (a, b) =>
    bandOrder(a) - bandOrder(b) ||
    ["normal", "anime", "tie_up"].indexOf(a.type) -
      ["normal", "anime", "tie_up"].indexOf(b.type) ||
    release(a, b);
  if (mode === "bpm" || mode === "duration") {
    const key = mode === "bpm" ? "bpm" : "durationSeconds";
    return (a, b) => (b[key] ?? -1) - (a[key] ?? -1) || band(a, b);
  }
  return mode === "release"
    ? release
    : mode === "kana"
      ? (a, b) =>
          collator.compare(
            normalize(a.reading || a.title),
            normalize(b.reading || b.title),
          ) || band(a, b)
      : /^(level|notes)-[0-4]$/.test(mode)
        ? (a, b) =>
            (b.difficulties[+mode.slice(-1)]?.[mode.split("-")[0]] ?? -1) -
              (a.difficulties[+mode.slice(-1)]?.[mode.split("-")[0]] ?? -1) ||
            band(a, b)
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

export function selectedFilters(params) {
  return {
    types: params.getAll("type").filter((v) => Object.hasOwn(typeNames, v)),
    bands: params.getAll("band").filter((v) => /^(?:[0-9])$/.test(v)),
  };
}
export function filteredSongs(songs, params) {
  const { types, bands } = selectedFilters(params);
  return songs.filter(
    (song) =>
      matches(song, params.get("q") || "") &&
      (!types.length || types.includes(song.type)) &&
      (!bands.length || bands.includes(String(bandOrder(song)))),
  );
}
export function pageNumbers(page, total) {
  const visible = new Set([1, total]);
  for (let n = Math.max(1, page - 2); n <= Math.min(total, page + 2); n++)
    visible.add(n);
  const result = [];
  let previous = 0;
  for (const n of [...visible].sort((a, b) => a - b)) {
    if (previous && n - previous > 1) result.push(null);
    result.push(n);
    previous = n;
  }
  return result;
}
