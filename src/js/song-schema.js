// ブラウザーの管理画面とビルドで共用する入力規則。
export const difficultyNames = ["EASY", "NORMAL", "HARD", "EXPERT", "SPECIAL"];
export const categoryCodes = {
  オリジナル: "normal",
  カバー: "anime",
  エクストラ: "tie_up",
};

export function validateSong(song, game = "garupa") {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!song || typeof song !== "object") fail("楽曲データが不正です。");
  if (!Number.isSafeInteger(song.id) || song.id < 1)
    fail("idは正の整数にしてください。");
  for (const key of ["title", "band"]) {
    if (
      typeof song[key] !== "string" ||
      !song[key].trim() ||
      song[key].length > 500
    )
      fail(`${key}を500文字以内で入力してください。`);
  }
  if (
    typeof song.reading !== "string" ||
    song.reading.length > 500 ||
    (game === "garupa" && !song.reading.trim())
  )
    fail("readingを500文字以内で入力してください。");
  if (!Object.hasOwn(categoryCodes, song.category))
    fail("種類を選択してください。");
  if (game === "ournotes" && song.category === "エクストラ")
    fail("アワーノーツではオリジナルまたはカバーを選択してください。");
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
  if (
    game === "garupa" &&
    song.live3d !== null &&
    typeof song.live3d !== "boolean"
  )
    fail("3Dライブの対応状況が不正です。");
  if (game === "ournotes") {
    if (Object.hasOwn(song, "live3d"))
      fail("アワーノーツに3Dライブはありません。");
    if (Object.hasOwn(song.difficulties ?? {}, "SPECIAL"))
      fail("アワーノーツにSPECIALはありません。");
    if (
      song.mv !== null &&
      song.mv !== undefined &&
      typeof song.mv !== "boolean"
    )
      fail("MVの有無が不正です。");
  }
  if (
    song.relatedSongIds !== undefined &&
    (!Array.isArray(song.relatedSongIds) ||
      song.relatedSongIds.length > 50 ||
      new Set(song.relatedSongIds).size !== song.relatedSongIds.length ||
      song.relatedSongIds.some(
        (reference) =>
          typeof reference !== "string" ||
          !/^(garupa|ournotes):[1-9][0-9]*$/.test(reference),
      ))
  )
    fail(
      "関連楽曲は「garupa:曲ID」または「ournotes:曲ID」を重複なく入力してください。",
    );
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
  for (const name of game === "ournotes"
    ? difficultyNames.slice(0, 4)
    : difficultyNames) {
    const chart = song.difficulties[name];
    if (chart === null) continue;
    if (
      !chart ||
      (chart.level != null &&
        (!Number.isInteger(chart.level) ||
          chart.level < 1 ||
          chart.level > 50)) ||
      (game === "garupa" && chart.level == null)
    )
      fail(`${name}のレベルを1〜50で入力してください。`);
    if (
      (chart.notes != null &&
        (!Number.isInteger(chart.notes) ||
          chart.notes < 1 ||
          chart.notes > 100000)) ||
      (game === "garupa" && chart.notes == null)
    )
      fail(`${name}のノーツ数を1〜100000で入力してください。`);
  }
  return song;
}
