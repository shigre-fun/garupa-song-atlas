import {
  difficulties,
  typeNames,
  bandOrder,
  colors,
  compareSongs,
  matches,
} from "./domain.js";
const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (n) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(n));
const badge = (s) => `<span class="tag ${s.type}">${typeNames[s.type]}</span>`;
const color = (s) => colors[bandOrder(s)];
const query = (p) => {
  const x = new URLSearchParams(p);
  return "/?" + x.toString();
};
export function renderList(data, params = new URLSearchParams()) {
  const q = params.get("q") || "";
  const mode = [
    "band",
    "kana",
    "release",
    ...difficulties.map((_, i) => `level-${i}`),
  ].includes(params.get("sort"))
    ? params.get("sort")
    : "band";
  const rows = data.songs.filter((s) => matches(s, q)).sort(compareSongs(mode));
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const page = Math.max(1, Math.min(pages, parseInt(params.get("page")) || 1));
  return `<section class="intro">
<div>
<p class="eyebrow">BANG DREAM! · SONG DATABASE</p>
<h1>${q ? "検索結果" : "楽曲を探す"}</h1>
<p>${q ? `「${e(q)}」に一致する楽曲` : "日本版の楽曲・難易度・原曲情報をまとめて検索。"}</p>
</div>
<div class="count">${rows.length}<small>曲</small>
</div>
</section>
<div class="toolbar">
<label>並べ替え<select id="sort">${[["band", "バンド順"], ...difficulties.map((d, i) => [`level-${i}`, `${d} レベルが高い順`]), ["kana", "楽曲名 50音順"], ["release", "配信順（古い順）"]].map(([v, t]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${t}</option>`).join("")}</select>
</label>
<div class="meta">日本版 · ${date(data.updatedAt)} 更新</div>
</div>${
    rows.length
      ? `<div class="table-wrap">
<table>
<thead>
<tr>
<th scope="col">楽曲名</th>
<th scope="col">バンド</th>
<th scope="col">種類</th>${difficulties.map((d, i) => `<th scope="col" class="diff-${i}">${d}</th>`).join("")}<th scope="col">配信日</th>
</tr>
</thead>
<tbody>${rows
          .slice((page - 1) * 50, page * 50)
          .map(
            (s) => `<tr>
<td>
<a class="song-title" href="/songs/${encodeURIComponent(s.slug)}/?${new URLSearchParams({ q, sort: mode, page })}">${e(s.title)}</a>${s.work ? `<div class="song-sub">${e(s.work)}</div>` : ""}</td>
<td>
<div class="band" style="--band:${color(s)}">${e(s.band)}</div>
</td>
<td>${badge(s)}</td>${s.difficulties.map((d, i) => `<td data-label="${difficulties[i]}" class="lv diff-${i}${d ? "" : " blank"}">${d?.level ?? "—"}</td>`).join("")}<td class="meta release-date">${date(s.publishedAt)}</td>
</tr>`,
          )
          .join("")}</tbody>
</table>
</div>
<nav class="pagination" aria-label="一覧のページ切り替え">
<button id="prev" ${page === 1 ? "disabled" : ""}>前へ</button>
<span>${page} / ${pages}</span>
<button id="next" ${page === pages ? "disabled" : ""}>次へ</button>
</nav>`
      : `<div class="panel empty">
<h2>一致する楽曲はありません</h2>
<p>短い曲名や作品名で試してください。</p>
<a href="/">すべての楽曲を見る</a>
</div>`
  }<p class="notice">「—」はその難易度が未実装です。レベルが同じ場合は、バンド → オリジナル・カバー・エクストラ → 配信順で並びます。 複数バンドの合同曲は「その他」に含めます。</p>
<details class="data-note">
<summary>並べ替えについて</summary>
<p>50音順は登録された読みを使用します。同時配信曲は登録された配信順、続いて管理用IDで並べます。</p>
</details>`;
}
export function renderDetail(s, data, params = new URLSearchParams()) {
  const q = params.get("q") || "";
  return `<a class="back" href="${query({ q, sort: params.get("sort") || "band", page: params.get("page") || 1 })}">← 楽曲一覧に戻る</a>
<section class="detail-top" style="--band:${color(s)}">${badge(s)}<h1>${e(s.title)}</h1>
<div class="detail-band">${e(s.band)}</div>
</section>
<div class="detail-grid">
<section class="panel">
<h2>難易度・ノーツ数</h2>
<table>
<thead>
<tr>
<th scope="col">難易度</th>
<th scope="col">レベル</th>
<th scope="col">ノーツ数</th>
</tr>
</thead>
<tbody>${s.difficulties
    .map(
      (d, i) => `<tr>
<th scope="row" class="diff-${i}">${difficulties[i]}</th>
<td class="lv diff-${i}">${d?.level ?? "—"}</td>
<td class="lv">${d ? (d.notes?.toLocaleString("ja-JP") ?? "未確認") : "—"}</td>
</tr>`,
    )
    .join("")}</tbody>
</table>
<p class="notice">「—」は未実装の難易度です。</p>
</section>
<section class="panel">
<h2>楽曲情報</h2>
<dl>
<dt>配信日（日本版）</dt>
<dd>${date(s.publishedAt)}</dd>
<dt>演奏バンド・参加アーティスト</dt>
<dd>${e(s.band)}</dd>
<dt>${s.type === "normal" ? "作曲" : "原曲の作曲者"}</dt>
<dd>${e(s.composer || "未確認")}</dd>${
    s.type === "normal"
      ? `<dt>3Dライブ</dt>
<dd>${s.live3d === true ? '<span class="pill">対応</span>' : s.live3d === false ? "非対応" : "確認中"}</dd>`
      : `<dt>原曲アーティスト</dt>
<dd>${e(s.artist || "未確認")}</dd>
<dt>原曲の使用作品・タイアップ</dt>
<dd>${e(s.work || "未登録")}</dd>`
  }</dl>
</section>
</div>
<p class="data-note">データ更新：${date(data.updatedAt)} · 日本版</p>`;
}
