// 2026-09-24の秒単位への移行。再実行しても値は変わらない。
import fs from "node:fs";

const reportPath = "data/research/song-timing.json";
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const records = new Map(report.records.map((record) => [record.id, record]));
const files = fs
  .readdirSync("data/songs")
  .map((slug) => `data/songs/${slug}/song.json`);
const changes = [];
for (const file of files) {
  const song = JSON.parse(fs.readFileSync(file, "utf8"));
  const record = records.get(song.id);
  const value = song.durationSeconds;
  if (value == null) continue;
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${file}: 演奏時間が不正です。`);
  if (record) {
    if (record.title !== song.title)
      throw new Error(`${file}: 調査記録の曲名が一致しません。`);
    const original = record.sourceLengthSeconds ?? record.durationSeconds;
    if (value !== original && value !== Math.floor(original))
      throw new Error(`${file}: 調査値と異なる演奏時間を自動変更しません。`);
    record.sourceLengthSeconds = original;
    record.durationSeconds = Math.floor(original);
  } else if (!Number.isInteger(value)) {
    throw new Error(`${file}: 調査記録のない小数値は自動変更しません。`);
  }
  if (!Number.isInteger(value))
    changes.push({
      file,
      song: { ...song, durationSeconds: Math.floor(value) },
    });
}
if (records.size !== 796) throw new Error("調査記録の曲数が想定と異なります。");
report.method = report.method.replace(
  "演奏時間はゲーム版length秒。",
  "演奏時間はゲーム版lengthを切り捨てた整数秒。元の小数はsourceLengthSecondsに保持。",
);
for (const { file, song } of changes)
  fs.writeFileSync(file, JSON.stringify(song, null, 2) + "\n");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${files.length}曲を確認し、${changes.length}曲の秒未満を切り捨てました。`,
);
