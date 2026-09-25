import { SITE_NAME } from "./site-config.js";
import { absoluteURL, siteURL } from "./urls.js";

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

export const safeJSON = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export function detailTitle(song, game, songs) {
  const same = songs.filter((candidate) => candidate.title === song.title);
  let label = song.title;
  if (same.length > 1) {
    label += `（${song.band}）`;
    if (same.filter((candidate) => candidate.band === song.band).length > 1)
      label += `（${song.type}）`;
    if (
      same.filter(
        (candidate) =>
          candidate.band === song.band && candidate.type === song.type,
      ).length > 1
    )
      label += ` #${song.stableSongId}`;
  }
  const fields = [
    song.bpm != null && "BPM",
    song.difficulties?.some(Boolean) && "難易度・ノーツ数",
  ].filter(Boolean);
  return `${label} - ${game.seoName}${fields.length ? ` ${fields.join("・")}` : " 楽曲情報"} | ${SITE_NAME}`;
}

export function detailDescription(song, game) {
  const facts = [];
  if (song.band) facts.push(`${song.band}の楽曲`);
  else if (song.artist) facts.push(`${song.artist}の楽曲`);
  if (song.bpm != null) facts.push(`基本BPMは${song.bpm}`);
  const expert = song.difficulties?.[3];
  if (expert)
    facts.push(`EXPERTはレベル${expert.level}、${expert.notes}ノーツ`);
  if (Number.isFinite(song.publishedAt)) {
    const date = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(song.publishedAt));
    facts.push(`配信日は${date}`);
  }
  return `${game.shortName}収録「${song.title}」の情報。${facts.join("。")}。`;
}

export function breadcrumbMarkup(items, settings) {
  if (items.length < 2) return "";
  return `<nav class="breadcrumbs" aria-label="パンくずリスト"><ol>${items.map((item, i) => `<li>${i === items.length - 1 ? `<span aria-current="page">${escapeHTML(item.name)}</span>` : `<a href="${escapeHTML(siteURL(item.path, settings.basePath))}">${escapeHTML(item.name)}</a>`}</li>`).join("")}</ol></nav>`;
}

export function breadcrumbJSON(items, settings) {
  if (items.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteURL(item.path, settings),
    })),
  };
}
