const link = document.querySelector("#new-song-url");
if (link) {
  const target = new URL(link.href);
  target.search = location.search;
  location.replace(target.href);
}
