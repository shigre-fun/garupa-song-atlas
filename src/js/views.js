import { siteURL, siteBase, songListPath, songPath } from "./urls.js";
import { GAMES } from "./site-config.js";
import {
  typeNames,
  bandOrder,
  colors,
  compareSongs,
  selectedFilters,
  filteredSongs,
  pageNumbers,
  sortState,
  sortLabels,
  nextSortParams,
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
const color = (s, game) => colors[bandOrder(s, game)] || colors.at(-1);
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "未確認";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
const query = (p, base, game = GAMES.garupa) => {
  const x = new URLSearchParams(p);
  return siteURL(songListPath(game) + "?" + x.toString(), base);
};
export function renderList(
  data,
  params = new URLSearchParams(),
  base = siteBase,
  game = GAMES.garupa,
) {
  if (!data.songs.length) {
    return `<section class="intro"><div><p class="eyebrow">${e(game.name)}</p><h1>${e(game.shortName)} 楽曲一覧</h1><p>楽曲データを準備しています。登録後、このページで検索できるようになります。</p></div><div class="count">0<small>曲</small></div></section><div class="panel empty"><h2>現在、登録されている楽曲はありません</h2><p>確認済みのデータから順次追加します。</p></div>`;
  }
  const q = params.get("q") || "";
  const { mode, difficulty, direction } = sortState(params, game);
  const rows = filteredSongs(data.songs, params, game).sort(
    compareSongs(mode, direction, difficulty, game),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const page = Math.max(1, Math.min(pages, parseInt(params.get("page")) || 1));
  const state = new URLSearchParams(params);
  state.set("q", q);
  state.set("sort", mode);
  state.set("difficulty", difficulty);
  state.set("direction", direction);
  state.set("page", page);
  const filters = selectedFilters(params, game);
  const pageURL = (number) => {
    const p = new URLSearchParams(state);
    p.set("page", number);
    return e(query(p, base, game));
  };
  return `<section class="intro">
<div>
<p class="eyebrow">BANG DREAM! · SONG DATABASE</p>
<h1>${q ? "検索結果" : `${e(game.shortName)}の楽曲を探す`}</h1>
<p>${q ? `「${e(q)}」に一致する楽曲` : "日本版の楽曲・難易度・原曲情報をまとめて検索。"}</p>
</div>
<div class="count">${rows.length}<small>曲</small>
</div>
</section>
<form id="filters" class="filters">
<fieldset><legend>楽曲の種類（複数選択可）</legend><div class="filter-options filter-types">${Object.entries(
    Object.fromEntries(game.categories.map((key) => [key, typeNames[key]])),
  )
    .map(
      ([value, label]) =>
        `<label><input type="checkbox" name="type" value="${value}" ${filters.types.includes(value) ? "checked" : ""}>${label}</label>`,
    )
    .join("")}</div></fieldset>
<fieldset><legend>バンド（複数選択可）</legend><div class="filter-options filter-bands">${[...game.bands, "その他"].map((label, i) => `<label><input type="checkbox" name="band" value="${i}" ${filters.bands.includes(String(i)) ? "checked" : ""}>${e(label)}</label>`).join("")}</div></fieldset>
<p class="notice">未選択の項目はすべて表示します。同じ項目内は「いずれか」、種類とバンドの間は「両方に一致」で絞り込みます。合同曲は「その他」です。</p>
<div class="filter-actions"><button type="submit">絞り込む</button> <a class="control-link" href="${e(query(new URLSearchParams([...params].filter(([key]) => key !== "type" && key !== "band")), base, game))}" id="clear-filters">絞り込みを解除</a></div>
</form>
<div class="toolbar">
<div class="sort-controls">
<label>難易度<select id="difficulty">${game.difficulties.map((name, i) => `<option value="${i}" ${i === difficulty ? "selected" : ""}>${name}</option>`).join("")}</select></label>
<div class="sort-buttons" role="group" aria-label="並べ方">${Object.entries(
    sortLabels,
  )
    .map(
      ([key, label]) =>
        `<a class="sort-link" href="${e(query(nextSortParams(params, key, game), base, game))}" data-sort="${key}" aria-current="${mode === key ? "true" : "false"}" aria-label="${label}${mode === key ? (direction === "reverse" ? "（逆順）" : "（通常順）") : ""}">${label}${mode === key ? `<span aria-hidden="true"> ${direction === "reverse" ? "▼" : "▲"}</span>` : ""}</a>`,
    )
    .join("")}</div>
<p class="notice">選択中の並べ方を押すと逆順になります。▲ 通常順 / ▼ 逆順。難易度はレベル順・ノーツ数順に適用されます。</p>
</div>
<div class="meta">日本版 · ${date(data.updatedAt)} 更新</div>
</div>${
    rows.length
      ? `<div class="table-wrap">
<table>
<thead>
<tr>
<th scope="col">楽曲名</th>
<th scope="col">バンド</th>
<th scope="col">種類</th>${game.difficulties.map((d, i) => `<th scope="col" class="diff-${i}">${d}</th>`).join("")}<th scope="col">配信日</th>
</tr>
</thead>
<tbody>${rows
          .slice((page - 1) * 50, page * 50)
          .map(
            (s) => `<tr>
<td>
<a class="song-title" href="${siteURL(songPath(game, s.stableSongId), base)}?${e(state.toString())}">${e(s.title)}</a>${s.work ? `<div class="song-sub">${e(s.work)}</div>` : ""}<div class="song-sub">基本BPM ${e(s.bpm ?? "未確認")} · 演奏時間 ${formatDuration(s.durationSeconds)}</div></td>
<td>
<div class="band" style="--band:${color(s, game)}">${e(s.band)}</div>
</td>
<td>${badge(s)}</td>${s.difficulties.map((d, i) => `<td data-label="${game.difficulties[i]}" class="lv diff-${i}${d ? "" : " blank"}">${d?.level ?? "—"}</td>`).join("")}<td class="meta release-date">${date(s.publishedAt)}</td>
</tr>`,
          )
          .join("")}</tbody>
</table>
</div>
<nav class="pagination" aria-label="一覧のページ切り替え">
${page === 1 ? '<span id="prev" aria-disabled="true">前へ</span>' : `<a id="prev" href="${pageURL(page - 1)}">前へ</a>`}
<span>${page} / ${pages}</span>
<div class="page-numbers">${pageNumbers(page, pages)
          .map((n) =>
            n === null
              ? '<span class="page-gap" aria-hidden="true">…</span>'
              : `<a href="${pageURL(n)}" aria-label="${n}ページ目" ${n === page ? 'aria-current="page"' : ""}>${n}</a>`,
          )
          .join("")}</div>
${page === pages ? '<span id="next" aria-disabled="true">次へ</span>' : `<a id="next" href="${pageURL(page + 1)}">次へ</a>`}
</nav>`
      : `<div class="panel empty">
<h2>一致する楽曲はありません</h2>
<p>短い曲名や作品名で試してください。</p>
<a href="${siteURL(songListPath(game), base)}">すべての楽曲を見る</a>
</div>`
  }<p class="notice">「—」はその難易度が未実装、またはレベル未確認です。通常順でレベル・ノーツ数が同じ場合は、バンド → ${game.categories.map((type) => typeNames[type]).join("・")} → 配信順で並びます。 複数バンドの合同曲は「その他」に含めます。</p>
<details class="data-note">
<summary>並べ替えについて</summary>
<p>通常順は、レベル・ノーツ数・BPM・演奏時間が大きいものから、配信日は過去から、楽曲名は50音順、バンドは所定の順番です。同値はバンド → 種類 → 配信順で比較し、逆順では同値の順序も反転します。未実装・未確認は常に最後です。BPMは基本BPM、時間はゲーム内の秒数を使用します。難易度はレベル・ノーツ数だけに影響します。</p>
</details>`;
}
export function renderDetail(
  s,
  data,
  params = new URLSearchParams(),
  base = siteBase,
  game = GAMES.garupa,
  related = [],
) {
  return `<a class="back" href="${e(query(params, base, game))}">← 楽曲一覧に戻る</a>
<section class="detail-top" style="--band:${color(s, game)}">${badge(s)}<h1>${e(s.title)}</h1>
<p class="detail-game">${e(game.name)}</p>
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
<th scope="row" class="diff-${i}">${game.difficulties[i]}</th>
<td class="lv diff-${i}">${d?.level ?? (d ? "未確認" : "—")}</td>
<td class="lv">${d ? (d.notes?.toLocaleString("ja-JP") ?? "未確認") : "—"}</td>
</tr>`,
    )
    .join("")}</tbody>
</table>
<p class="notice">「—」は未実装の難易度です。未確認の数値は確認後に追加します。</p>
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
      ? game.id === "garupa"
        ? `<dt>3Dライブ</dt>
<dd>${s.live3d === true ? '<span class="pill">対応</span>' : s.live3d === false ? "非対応" : "確認中"}</dd>`
        : ""
      : `<dt>原曲アーティスト</dt>
<dd>${e(s.artist || "未確認")}</dd>
<dt>原曲の使用作品・タイアップ</dt>
<dd>${e(s.work || "未登録")}</dd>`
  }</dl>
</section>
</div>
${related.length ? `<section class="panel related-songs"><h2>同じ楽曲の別の譜面・収録先</h2><ul>${related.map((other) => `<li><a href="${e(siteURL(songPath(GAMES[other.gameId], other.stableSongId), base))}">${e(other.title)}</a><span>${e(GAMES[other.gameId].shortName)} · ${e(other.band)}</span></li>`).join("")}</ul></section>` : ""}
<p class="data-note">データ更新：${date(data.updatedAt)} · 日本版</p>`;
}
