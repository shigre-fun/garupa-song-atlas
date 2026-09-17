import fs from "node:fs";
import path from "node:path";

export const difficultyNames = ["EASY", "NORMAL", "HARD", "EXPERT", "SPECIAL"];
export const categoryCodes = {
  オリジナル: "normal",
  カバー: "anime",
  エクストラ: "tie_up",
};

// Windowsでも使える、曲名を読めるフォルダー名にする。
export function folderName(title) {
  let name = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!name || name === "." || name === "..")
    throw new Error("有効な楽曲名を入力してください。");
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))
    name = "曲-" + name;
  return name;
}

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
    if (folderName(slug) !== slug || /^\d+$/.test(slug))
      fail("フォルダーには楽曲名かローマ字表記を使ってください。");
    if (folded.has(slug.toLowerCase()))
      fail("大文字・小文字だけ異なるフォルダーがあります。");
    folded.add(slug.toLowerCase());
    if (!Number.isInteger(song.id) || ids.has(song.id))
      fail("idは重複しない整数にしてください。");
    ids.add(song.id);
    for (const key of ["title", "reading", "band"])
      if (!song[key]?.trim()) fail(`${key}を入力してください。`);
    if (!categoryCodes[song.category])
      fail("categoryはオリジナル・カバー・エクストラのいずれかです。");
    if (!Number.isFinite(Date.parse(song.releaseDate)))
      fail("releaseDateに有効な配信日時を入力してください。");
    if (!Array.isArray(song.aliases)) fail("aliasesは配列にしてください。");
    if (song.live3d !== null && typeof song.live3d !== "boolean")
      fail("live3dはtrue/false/nullです。");
    const charts = difficultyNames.map((name) => {
      if (!(name in song.difficulties))
        fail(`${name}を記入してください（未実装ならnull）。`);
      const chart = song.difficulties[name];
      if (chart === null) return null;
      if (!Number.isInteger(chart.level) || chart.level < 1 || chart.level > 50)
        fail(`${name}のlevelが不正です。`);
      if (!Number.isInteger(chart.notes) || chart.notes < 1)
        fail(`${name}のnotesが不正です。`);
      return chart;
    });
    return {
      id: song.id,
      slug,
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
      aliases: song.aliases,
      difficulties: charts,
    };
  });
}
