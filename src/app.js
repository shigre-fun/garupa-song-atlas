import { siteURL, siteBase } from "./urls.js";
const pagePath = "/" + location.pathname.slice(siteBase.length);
import { renderList, renderDetail } from "./views.js";
import { filteredSongs } from "./domain.js";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const q = params.get("q") || "";
document.querySelector("#search").value = q;
const listURL = (values) => siteURL("?" + new URLSearchParams(values));
const navigate = (changes) => {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) next.set(key, value);
  location.href = listURL(next);
};
document.querySelector('form[role="search"]').onsubmit = (event) => {
  event.preventDefault();
  navigate({ q: document.querySelector("#search").value, page: 1 });
};
const backLink = document.querySelector(".back");
if (backLink) backLink.href = listURL(params);
if (pagePath === "/" && params.size)
  app.innerHTML = '<p role="status">検索結果を読み込んでいます…</p>';

function notFound() {
  document.title = "ページが見つかりません | ガルパ楽曲ノート";
  return `<div class="empty"><h1>楽曲が見つかりません</h1><p>配信終了やURLの変更の可能性があります。</p><a href="${siteURL("")}">楽曲一覧へ戻る</a></div>`;
}

try {
  const response = await fetch(siteURL("songs.json"));
  if (!response.ok) throw new Error("Catalog unavailable");
  const data = await response.json();
  const slug = pagePath.match(/^\/songs\/([^/]+)\/?$/)?.[1];
  if (slug) {
    const song = data.songs.find(
      (song) => song.slug === decodeURIComponent(slug),
    );
    app.innerHTML = song ? renderDetail(song, data, params) : notFound();
    if (song) document.title = song.title + " | ガルパ楽曲ノート";
  } else if (pagePath === "/") {
    app.innerHTML = renderList(data, params);
    const select = document.querySelector("#sort");
    const sort = select.value;
    select.onchange = (event) =>
      navigate({ sort: event.target.value, page: 1 });
    document.querySelector("#filters").onsubmit = (event) => {
      event.preventDefault();
      const next = new URLSearchParams(params);
      next.delete("type");
      next.delete("band");
      next.set("page", 1);
      for (const [key, value] of new FormData(event.currentTarget))
        next.append(key, value);
      location.href = listURL(next);
    };
    document.querySelector("#clear-filters").onclick = () => {
      const next = new URLSearchParams(params);
      next.delete("type");
      next.delete("band");
      next.set("page", 1);
      location.href = listURL(next);
    };
    const pages = Math.max(
      1,
      Math.ceil(filteredSongs(data.songs, params).length / 50),
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
      if (button) button.onclick = () => navigate({ sort, page: page + delta });
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
