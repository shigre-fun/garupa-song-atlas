import { siteURL, siteBase, songListPath } from "./urls.js";
import { GAMES } from "./site-config.js";
import { renderList } from "./views.js";
import { filteredSongs, sortState, nextSortParams } from "./domain.js";

const pagePath = "/" + location.pathname.slice(siteBase.length);
const params = new URLSearchParams(location.search);
const pageGame = Object.values(GAMES).find((game) =>
  pagePath.startsWith("/" + game.slug + "/"),
);
const listPath = pageGame ? "/" + songListPath(pageGame) : "";
const legacyListKeys = [
  "q",
  "sort",
  "page",
  "difficulty",
  "direction",
  "type",
  "band",
];
const listURL = (values, game = GAMES.garupa) =>
  siteURL(songListPath(game) + "?" + new URLSearchParams(values));

// 旧トップに保存された検索・フィルターURLを新一覧へ引き継ぐ。
if (pagePath === "/" && legacyListKeys.some((key) => params.has(key))) {
  location.replace(listURL(params));
} else {
  const search = document.querySelector("#search");
  if (search)
    search.value =
      !pageGame || pageGame.id === GAMES.garupa.id ? params.get("q") || "" : "";
  const backLink = document.querySelector(".back");
  if (backLink && params.size && pageGame)
    backLink.href = listURL(params, pageGame);

  if (pagePath === listPath) {
    if (!pageGame.fields.includes("level")) {
      if (params.size)
        fetch(siteURL(pageGame.catalog))
          .then((response) => {
            if (!response.ok) throw new Error("Catalog unavailable");
            return response.json();
          })
          .then((data) => {
            document.querySelector("#app-content").innerHTML = renderList(
              data,
              params,
              siteBase,
              pageGame,
            );
          })
          .catch(() => {
            const notice = document.createElement("p");
            notice.className = "notice";
            notice.setAttribute("role", "alert");
            notice.textContent =
              "検索用データを読み込めませんでした。接続を確認して再読み込みしてください。";
            document.querySelector("#app-content").prepend(notice);
          });
    } else {
      const navigate = (changes) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes))
          next.set(key, value);
        location.href = listURL(next);
      };
      const connectControls = (data) => {
        const sorting = sortState(params);
        document.querySelector("#difficulty").onchange = (event) =>
          navigate({
            sort: sorting.mode,
            difficulty: event.target.value,
            page: 1,
          });
        for (const link of document.querySelectorAll("[data-sort]"))
          link.href = listURL(nextSortParams(params, link.dataset.sort));
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
        const clear = document.querySelector("#clear-filters");
        if (clear) {
          const next = new URLSearchParams(params);
          next.delete("type");
          next.delete("band");
          next.set("page", 1);
          clear.href = listURL(next);
        }
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
          const link = document.querySelector("#" + name);
          if (link) {
            const next = new URLSearchParams(params);
            next.set("page", page + delta);
            link.href = listURL(next);
          }
        }
      };

      // 静的な初期一覧を残し、クエリ付きURLだけカタログで差し替える。
      fetch(siteURL(GAMES.garupa.catalog))
        .then((response) => {
          if (!response.ok) throw new Error("Catalog unavailable");
          return response.json();
        })
        .then((data) => {
          if (params.size)
            document.querySelector("#app-content").innerHTML = renderList(
              data,
              params,
              siteBase,
              GAMES.garupa,
            );
          connectControls(data);
        })
        .catch(() => {
          const notice = document.createElement("p");
          notice.className = "notice";
          notice.setAttribute("role", "alert");
          notice.textContent =
            "検索用データを読み込めませんでした。接続を確認して再読み込みしてください。";
          document.querySelector("#app-content").prepend(notice);
        });
    }
  }
}
