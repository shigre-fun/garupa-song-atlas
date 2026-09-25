// 一度限りの調査用。外部通信は行わず、保存した公開データを照合する。
// node scripts/research/song-timing.mjs <songs-all-7.json> [--apply]
import fs from "node:fs";
import crypto from "node:crypto";
import {
  GARUPA_SONGS_PATH,
  findGarupaSong,
  listGarupaSongs,
} from "../../src/js/garupa-data.js";
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("調査元のJSONファイルを指定してください。");
const raw = fs.readFileSync(sourcePath, "utf8");
const source = JSON.parse(raw);
const norm = (value) => value.normalize("NFKC");
const records = [];
const pending = [];
const unmatched = [];
const data = JSON.parse(fs.readFileSync(GARUPA_SONGS_PATH, "utf8"));
for (const song of listGarupaSongs(data)) {
  // 管理IDは外部IDとは限らない。曲名が違う場合は必ず明示対応を使う。
  const sourceId =
    song.id === 821 && song.title === "Resound the Way" ? 812 : song.id;
  const entry = source[sourceId];
  if (!entry) {
    unmatched.push({ id: song.id, title: song.title });
    continue;
  }
  if (norm(entry.musicTitle[0]) !== norm(song.title))
    throw new Error(`${song.title}: 外部ID/曲名が一致しません。`);
  if (sourceId === 812 && (entry.bandId !== 5 || song.band !== "Roselia"))
    throw new Error("Resound the Wayの演奏バンドが一致しません。");
  if (!(entry.length > 0) || !Number.isFinite(entry.length))
    throw new Error(`${song.title}: 演奏時間がありません。`);
  const segments = entry.bpm?.[3];
  if (!segments?.length)
    throw new Error(`${song.title}: EXPERTのBPMがありません。`);
  const durations = new Map();
  for (const segment of segments) {
    if (
      !(segment.bpm > 0) ||
      !Number.isFinite(segment.bpm) ||
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      segment.end < segment.start
    )
      throw new Error(`${song.title}: 不正なBPM区間です。`);
    // 時間0の初期化イベントは演奏区間ではないため集計しない。
    const seconds =
      Math.min(entry.length, segment.end) - Math.max(0, segment.start);
    if (seconds > 0)
      durations.set(segment.bpm, (durations.get(segment.bpm) || 0) + seconds);
  }
  const byDuration = [...durations].sort((a, b) => b[1] - a[1]);
  if (!byDuration.length)
    throw new Error(`${song.title}: 有効なBPM区間がありません。`);
  const timing = {
    bpm: byDuration[0][0],
    bpmMin: Math.min(...durations.keys()),
    bpmMax: Math.max(...durations.keys()),
    durationSeconds: Math.floor(entry.length),
  };
  records.push({
    id: song.id,
    sourceId,
    bandId: entry.bandId,
    sourceLengthSeconds: entry.length,
    segments,
    difficultyDifferences: Object.entries(entry.bpm)
      .filter(
        ([key, value]) =>
          key !== "3" && JSON.stringify(value) !== JSON.stringify(segments),
      )
      .map(([key]) => key),
  });
  pending.push({ song, timing });
}
const report = {
  sourceURL: "https://bestdori.com/api/songs/all.7.json",
  fetchedAt: fs.statSync(sourcePath).mtime.toISOString(),
  sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  method:
    "EXPERT譜面の時間が正のBPM区間を使用。基本BPMは同値の合計秒数が最大の値（同時間なら最初の出現）、上下限はその最小/最大。演奏時間はゲーム版lengthを切り捨てた整数秒。元の小数はsourceLengthSecondsに保持。",
  records,
};
if (process.argv.includes("--apply")) {
  for (const { song, timing } of pending) {
    for (const [key, value] of Object.entries(timing)) {
      if (song[key] != null && song[key] !== value)
        throw new Error(`${song.title}: 既存の${key}を上書きしません。`);
    }
  }
  for (const { song, timing } of pending)
    Object.assign(
      findGarupaSong(data, song.id).group.songs.find(
        (entry) => entry.id === song.id,
      ),
      timing,
    );
  fs.writeFileSync(GARUPA_SONGS_PATH, JSON.stringify(data, null, 2) + "\n");
}
fs.writeFileSync(
  "data/garupa/song-timing-research.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      songs: records.length,
      variable: records.filter((s) => s.bpmMin !== s.bpmMax).length,
      differentCharts: records
        .filter((s) => s.difficultyDifferences.length)
        .map((s) => ({
          id: s.id,
          difficulties: s.difficultyDifferences,
        })),
      unmatched,
      applied: process.argv.includes("--apply"),
    },
    null,
    2,
  ),
);
