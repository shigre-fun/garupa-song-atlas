const tracked = [
  "q",
  "sort",
  "page",
  "difficulty",
  "direction",
  "type",
  "band",
];
const params = new URLSearchParams(location.search);
const isList = document.currentScript.dataset.indexPage === "list";
const isLegacyRoot =
  document.currentScript.dataset.indexPage === "root" &&
  location.pathname === new URL(".", document.currentScript.src).pathname;
if ((isList || isLegacyRoot) && tracked.some((key) => params.has(key))) {
  const meta = document.createElement("meta");
  meta.name = "robots";
  meta.content = "noindex,follow";
  document.head.append(meta);
}
