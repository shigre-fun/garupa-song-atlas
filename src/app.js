import { renderList, renderDetail } from "./views.js";
import { matches } from "./domain.js";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const q = params.get("q") || "";
document.querySelector("#search").value = q;
const listURL = (values) => "/?" + new URLSearchParams(values);
const backLink = document.querySelector(".back");
if (backLink)
  backLink.href = listURL({
    q,
    sort: params.get("sort") || "band",
    page: params.get("page") || 1,
  });
if (location.pathname === "/" && params.size)
  app.innerHTML = '<p role="status">検索結果を読み込んでいます…</p>';

function notFound() {
  document.title = "ページが見つかりません | ガルパ楽曲ノート";
  return '<div class="empty"><h1>楽曲が見つかりません</h1><p>配信終了やURLの変更の可能性があります。</p><a href="/">楽曲一覧へ戻る</a></div>';
}

try {
  const response = await fetch("/songs.json");
  if (!response.ok) throw new Error("Catalog unavailable");
  const data = await response.json();
  const slug = location.pathname.match(/^\/songs\/([^/]+)\/?$/)?.[1];
  if (slug) {
    const song = data.songs.find(
      (song) => song.slug === decodeURIComponent(slug),
    );
    app.innerHTML = song ? renderDetail(song, data, params) : notFound();
    if (song) document.title = song.title + " | ガルパ楽曲ノート";
  } else if (location.pathname === "/") {
    app.innerHTML = renderList(data, params);
    const select = document.querySelector("#sort");
    const sort = select.value;
    select.onchange = (event) =>
      (location.href = listURL({ q, sort: event.target.value }));
    const pages = Math.max(
      1,
      Math.ceil(data.songs.filter((song) => matches(song, q)).length / 50),
    );
    const page = Math.max(
      1,
      Math.min(pages, parseInt(params.get("page")) || 1),
    );
    for (const [name, delta] of [
      ["prev", -1],
      ["next", 1],
    ]) {
      const button = document.querySelector("#" + name);
      if (button)
        button.onclick = () =>
          (location.href = listURL({ q, sort, page: page + delta }));
    }
  } else {
    app.innerHTML = notFound();
  }
} catch {
  const notice = document.createElement("p");
  notice.className = "notice";
  notice.setAttribute("role", "alert");
  notice.textContent =
    "検索用データを読み込めませんでした。接続を確認して、再読み込みしてください。";
  app.prepend(notice);
}
