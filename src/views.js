import { siteURL, siteBase } from "./urls.js";
import {
  difficulties,
  typeNames,
  bandOrder,
  colors,
  compareSongs,
  matches,
  bandNames,
  selectedFilters,
  filteredSongs,
  pageNumbers,
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
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "未確認";
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  const secondsPart = String(
    Math.floor((milliseconds % 60000) / 1000),
  ).padStart(2, "0");
  const fraction = String(milliseconds % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${minutes}:${secondsPart}${fraction ? "." + fraction : ""}`;
}
const query = (p, base) => {
  const x = new URLSearchParams(p);
  return siteURL("?" + x.toString(), base);
};
export function renderList(
  data,
  params = new URLSearchParams(),
  base = siteBase,
) {
  const q = params.get("q") || "";
  const mode = [
    "band",
    "kana",
    "release",
    "bpm",
    "duration",
    ...difficulties.map((_, i) => `level-${i}`),
  ].includes(params.get("sort"))
    ? params.get("sort")
    : "band";
  const rows = filteredSongs(data.songs, params).sort(compareSongs(mode));
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const page = Math.max(1, Math.min(pages, parseInt(params.get("page")) || 1));
  const state = new URLSearchParams(params);
  state.set("q", q);
  state.set("sort", mode);
  state.set("page", page);
  const filters = selectedFilters(params);
  const pageURL = (number) => {
    const p = new URLSearchParams(state);
    p.set("page", number);
    return e(query(p, base));
  };
  return `<section class="intro">
<div>
<p class="eyebrow">BANG DREAM! · SONG DATABASE</p>
<h1>${q ? "検索結果" : "楽曲を探す"}</h1>
<p>${q ? `「${e(q)}」に一致する楽曲` : "日本版の楽曲・難易度・原曲情報をまとめて検索。"}</p>
</div>
<div class="count">${rows.length}<small>曲</small>
</div>
</section>
<form id="filters" class="filters">
<fieldset><legend>楽曲の種類（複数選択可）</legend><div class="filter-options filter-types">${Object.entries(
    typeNames,
  )
    .map(
      ([value, label]) =>
        `<label><input type="checkbox" name="type" value="${value}" ${filters.types.includes(value) ? "checked" : ""}>${label}</label>`,
    )
    .join("")}</div></fieldset>
<fieldset><legend>バンド（複数選択可）</legend><div class="filter-options filter-bands">${[...bandNames, "その他"].map((label, i) => `<label><input type="checkbox" name="band" value="${i}" ${filters.bands.includes(String(i)) ? "checked" : ""}>${e(label)}</label>`).join("")}</div></fieldset>
<p class="notice">未選択の項目はすべて表示します。同じ項目内は「いずれか」、種類とバンドの間は「両方に一致」で絞り込みます。合同曲は「その他」です。</p>
<div class="filter-actions"><button type="submit">絞り込む</button> <button type="button" id="clear-filters">絞り込みを解除</button></div>
</form>
<div class="toolbar">
<label>並べ替え<select id="sort">${[["band", "バンド順"], ...difficulties.map((d, i) => [`level-${i}`, `${d} レベルが高い順`]), ["bpm", "BPM（速い順）"], ["duration", "楽曲演奏時間（長い順）"], ["kana", "楽曲名 50音順"], ["release", "配信順（古い順）"]].map(([v, t]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${t}</option>`).join("")}</select>
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
<a class="song-title" href="${siteURL(`songs/${encodeURIComponent(s.slug)}/`, base)}?${e(state.toString())}">${e(s.title)}</a>${s.work ? `<div class="song-sub">${e(s.work)}</div>` : ""}<div class="song-sub">基本BPM ${e(s.bpm ?? "未確認")} · 演奏時間 ${formatDuration(s.durationSeconds)}</div></td>
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
<div class="page-numbers">${pageNumbers(page, pages)
          .map((n) =>
            n === null
              ? '<span class="page-gap" aria-hidden="true">…</span>'
              : `<a href="${pageURL(n)}" aria-label="${n}ページ目" ${n === page ? 'aria-current="page"' : ""}>${n}</a>`,
          )
          .join("")}</div>
<button id="next" ${page === pages ? "disabled" : ""}>次へ</button>
</nav>`
      : `<div class="panel empty">
<h2>一致する楽曲はありません</h2>
<p>短い曲名や作品名で試してください。</p>
<a href="${siteURL("", base)}">すべての楽曲を見る</a>
</div>`
  }<p class="notice">「—」はその難易度が未実装です。レベルが同じ場合は、バンド → オリジナル・カバー・エクストラ → 配信順で並びます。 複数バンドの合同曲は「その他」に含めます。</p>
<details class="data-note">
<summary>並べ替えについて</summary>
<p>50音順は登録された読みを使用します。同時配信曲は登録された配信順、続いて管理用IDで並べます。BPM順は基本BPM、演奏時間順はゲーム内の秒数を比較します。同値はバンド → 種類 → 配信順、未確認は最後です。</p>
</details>`;
}
export function renderDetail(
  s,
  data,
  params = new URLSearchParams(),
  base = siteBase,
) {
  const q = params.get("q") || "";
  return `<a class="back" href="${e(query(params, base))}">← 楽曲一覧に戻る</a>
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
<dt>基本BPM</dt><dd>${e(s.bpm ?? "未確認")}</dd>
<dt>BPMの下限〜上限</dt><dd>${e(s.bpmMin ?? s.bpm ?? "未確認")} 〜 ${e(s.bpmMax ?? s.bpm ?? "未確認")}</dd>
<dt>楽曲演奏時間（ゲーム内）</dt><dd>${formatDuration(s.durationSeconds)}</dd>
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
