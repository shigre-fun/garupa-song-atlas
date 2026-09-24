// ブラウザーの管理画面とビルドで共用する入力規則。
export const difficultyNames = ["EASY", "NORMAL", "HARD", "EXPERT", "SPECIAL"];
export const categoryCodes = {
  オリジナル: "normal",
  カバー: "anime",
  エクストラ: "tie_up",
};

export function folderName(title) {
  if (typeof title !== "string") throw new Error("楽曲名を入力してください。");
  let name = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/[. ]+$/g, "");
  if (!name || name === "." || name === "..")
    throw new Error("有効な楽曲名を入力してください。");
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))
    name = "曲-" + name;
  return name;
}

export function validateSong(song, slug) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    typeof slug !== "string" ||
    slug !== folderName(slug) ||
    /^\d+$/.test(slug) ||
    slug.length > 120
  )
    fail("フォルダー名は120文字以内の楽曲名かローマ字にしてください。");
  if (!song || typeof song !== "object") fail("楽曲データが不正です。");
  if (!Number.isSafeInteger(song.id) || song.id < 1)
    fail("idは正の整数にしてください。");
  for (const key of ["title", "reading", "band"]) {
    if (
      typeof song[key] !== "string" ||
      !song[key].trim() ||
      song[key].length > 500
    )
      fail(`${key}を500文字以内で入力してください。`);
  }
  if (!Object.hasOwn(categoryCodes, song.category))
    fail("種類を選択してください。");
  if (
    typeof song.releaseDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
      song.releaseDate,
    ) ||
    !Number.isFinite(Date.parse(song.releaseDate))
  )
    fail("配信日時を入力してください。");
  if (
    song.releaseOrder !== null &&
    (!Number.isSafeInteger(song.releaseOrder) || song.releaseOrder < 0)
  )
    fail("同時配信の順序は0以上の整数にしてください。");
  for (const key of ["composer", "originalArtist", "originalWork"]) {
    if (
      song[key] !== null &&
      (typeof song[key] !== "string" || song[key].length > 2000)
    )
      fail(`${key}は2000文字以内の文字列かnullです。`);
  }
  if (
    !Array.isArray(song.aliases) ||
    song.aliases.length > 50 ||
    song.aliases.some((x) => typeof x !== "string" || x.length > 500)
  )
    fail("検索用別名は500文字以内、50件までです。");
  if (song.live3d !== null && typeof song.live3d !== "boolean")
    fail("3Dライブの対応状況が不正です。");
  for (const key of ["bpm", "bpmMin", "bpmMax", "durationSeconds"]) {
    if (song[key] != null && (!Number.isFinite(song[key]) || song[key] <= 0))
      fail(
        `${key}は0より大きい数値で入力してください。未確認の場合は空欄にします。`,
      );
  }
  if (
    song.durationSeconds != null &&
    !Number.isSafeInteger(song.durationSeconds)
  )
    fail("durationSecondsは秒単位の整数にしてください。");
  if ((song.bpmMin != null) !== (song.bpmMax != null))
    fail("BPMの下限と上限は両方入力してください。");
  if (
    song.bpmMin != null &&
    (song.bpm == null || song.bpmMin > song.bpm || song.bpm > song.bpmMax)
  )
    fail("BPMは下限 ≦ 基本BPM ≦ 上限になるように入力してください。");
  if (!song.difficulties || typeof song.difficulties !== "object")
    fail("難易度を入力してください。");
  for (const name of difficultyNames) {
    const chart = song.difficulties[name];
    if (chart === null) continue;
    if (
      !chart ||
      !Number.isInteger(chart.level) ||
      chart.level < 1 ||
      chart.level > 50
    )
      fail(`${name}のレベルを1〜50で入力してください。`);
    if (
      !Number.isInteger(chart.notes) ||
      chart.notes < 1 ||
      chart.notes > 100000
    )
      fail(`${name}のノーツ数を1〜100000で入力してください。`);
  }
  return song;
}
