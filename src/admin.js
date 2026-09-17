import { bandNames } from "./domain.js";
import { difficultyNames, folderName, validateSong } from "./song-schema.js";
import { GitHubStore } from "./github-store.js";
import { siteURL } from "./urls.js";

const form = document.querySelector("#song-form");
const connection = document.querySelector("#connection-form");
const status = document.querySelector("#form-status");
const draftStatus = document.querySelector("#draft-status");
const draftKey = "garupa-song-draft-v1:" + new URL(".", location.href).pathname;
const settingsKey = draftKey + ":repository";
let store = null;
let busy = false;
let submissionId = crypto.randomUUID();
let savedResult = null;

function storageRead(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function storageWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function message(text, type = "") {
  status.textContent = text;
  status.className = "message " + type;
}

for (const name of [...bandNames, "その他"]) {
  const option = document.createElement("option");
  option.textContent = name;
  form.elements.band.append(option);
}
document.querySelector("#charts").innerHTML = difficultyNames
  .map(
    (name) => `
  <div class="chart">
    <label><input type="checkbox" name="${name}-enabled" ${name !== "SPECIAL" ? "checked" : ""}>${name}</label>
    <label>レベル<input name="${name}-level" type="number" min="1" max="50" step="1" inputmode="numeric" aria-label="${name} レベル"></label>
    <label>ノーツ数<input name="${name}-notes" type="number" min="1" max="100000" step="1" inputmode="numeric" aria-label="${name} ノーツ数"></label>
  </div>`,
  )
  .join("");

function updateVisibility() {
  const original = form.elements.category.value === "オリジナル";
  document.querySelector("#original-fields").hidden = !original;
  document.querySelector("#cover-fields").hidden = original;
  const other = form.elements.band.value === "その他";
  document.querySelector("#other-band-label").hidden = !other;
  form.elements.otherBand.required = other;
  for (const name of difficultyNames) {
    const enabled = form.elements[`${name}-enabled`].checked;
    for (const field of ["level", "notes"]) {
      const input = form.elements[`${name}-${field}`];
      input.disabled = !enabled || busy;
      input.required = enabled;
    }
  }
}
function draftValues() {
  const values = {};
  for (const element of form.elements) {
    if (element.name)
      values[element.name] =
        element.type === "checkbox" ? element.checked : element.value;
  }
  return values;
}
function saveDraft() {
  const ok = storageWrite(draftKey, {
    values: draftValues(),
    submissionId,
    savedResult,
  });
  draftStatus.textContent = ok
    ? "この端末に下書きを保存しました。"
    : "端末への下書き保存が利用できません。この画面を閉じる前にGitHubへ保存してください。";
}
function showResult(result) {
  document.querySelector("#result").hidden = false;
  document.querySelector("#saved-message").textContent =
    `「${result.title}」をGitHubに保存しました。サイトへの反映には更新処理の完了が必要です。`;
  const repository = `https://github.com/${encodeURIComponent(result.owner)}/${encodeURIComponent(result.repo)}`;
  document.querySelector("#commit-link").href =
    `${repository}/commit/${encodeURIComponent(result.head)}`;
  document.querySelector("#workflow-link").href = `${repository}/actions`;
  document.querySelector("#publish-status").textContent =
    "保存済み・サイトの更新待ち";
  document.querySelector("#song-link").hidden = true;
}

const draft = storageRead(draftKey);
if (draft?.values) {
  for (const element of form.elements) {
    const value = draft.values[element.name];
    if (element.type === "checkbox" && typeof value === "boolean")
      element.checked = value;
    else if (element.name && typeof value === "string") element.value = value;
  }
  if (typeof draft.submissionId === "string") submissionId = draft.submissionId;
  if (draft.savedResult?.slug && draft.savedResult?.head) {
    savedResult = draft.savedResult;
    showResult(savedResult);
  }
  draftStatus.textContent = "前回の入力を復元しました。";
}
updateVisibility();
form.addEventListener("input", () => {
  if (busy) return;
  submissionId = crypto.randomUUID();
  savedResult = null;
  document.querySelector("#result").hidden = true;
  updateVisibility();
  saveDraft();
});

try {
  const response = await fetch(siteURL("admin-config.json"));
  const defaults = response.ok ? await response.json() : {};
  const previous = storageRead(settingsKey) || {};
  for (const key of ["owner", "repo", "branch"])
    connection.elements[key].value =
      defaults[key] || previous[key] || (key === "branch" ? "main" : "");
} catch {
  /* 保存先は手動でも入力できる。 */
}

connection.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const button = document.querySelector("#connect");
  button.disabled = true;
  const connectionStatus = document.querySelector("#connection-status");
  connectionStatus.textContent = "GitHubとの接続を確認しています…";
  try {
    const settings = Object.fromEntries(
      ["owner", "repo", "branch"].map((key) => [
        key,
        connection.elements[key].value,
      ]),
    );
    const candidate = new GitHubStore(
      settings,
      connection.elements.token.value,
    );
    const checked = await candidate.connect();
    store = candidate;
    storageWrite(settingsKey, checked);
    connectionStatus.textContent = `${checked.owner}/${checked.repo}（${checked.branch}）に接続しました。`;
    document.querySelector("#disconnect").hidden = false;
    button.hidden = true;
    for (const element of connection.elements)
      if (element.name) element.disabled = true;
  } catch (error) {
    connectionStatus.textContent = error.message;
  } finally {
    connection.elements.token.value = "";
    button.disabled = false;
  }
});
document.querySelector("#disconnect").addEventListener("click", () => {
  if (busy) return;
  if (store) store.token = "";
  store = null;
  for (const element of connection.elements) element.disabled = false;
  document.querySelector("#connect").hidden = false;
  document.querySelector("#disconnect").hidden = true;
  document.querySelector("#connection-status").textContent =
    "接続を解除しました。";
});

function enteredSong() {
  const value = (key) => form.elements[key].value.trim();
  const original = value("category") === "オリジナル";
  const band = value("band") === "その他" ? value("otherBand") : value("band");
  const song = {
    id: 1,
    title: value("title"),
    reading: value("reading"),
    category: value("category"),
    band: band + (value("guests") ? "×" + value("guests") : ""),
    releaseDate: value("releaseDate") + "+09:00",
    releaseOrder:
      value("releaseOrder") === "" ? null : Number(value("releaseOrder")),
    composer: value("composer") || null,
    originalArtist: original ? null : value("originalArtist") || null,
    originalWork: original ? null : value("originalWork") || null,
    live3d: original ? JSON.parse(value("live3d")) : null,
    aliases: value("aliases")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
    difficulties: Object.fromEntries(
      difficultyNames.map((name) => [
        name,
        form.elements[`${name}-enabled`].checked
          ? {
              level: Number(value(`${name}-level`)),
              notes: Number(value(`${name}-notes`)),
            }
          : null,
      ]),
    ),
  };
  const slug = folderName(value("slug") || song.title);
  validateSong(song, slug);
  return { song, slug };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!store) {
    message(
      "先に「保存先に接続」でGitHubに接続してください。入力内容は保持しています。",
      "error",
    );
    status.focus();
    return;
  }
  let entry;
  try {
    entry = enteredSong();
  } catch (error) {
    message(error.message, "error");
    status.focus();
    return;
  }
  saveDraft();
  busy = true;
  for (const element of [...form.elements, ...connection.elements])
    element.disabled = true;
  message("楽曲をGitHubに保存しています。この画面を閉じずにお待ちください。");
  try {
    const result = await store.addSong(entry.song, entry.slug, submissionId);
    savedResult = { ...result, title: entry.song.title, ...store.settings };
    showResult(savedResult);
    message(
      "保存しました。下のボタンでサイトへの反映を確認できます。",
      "success",
    );
    saveDraft();
  } catch (error) {
    message(error.message, "error");
  } finally {
    busy = false;
    for (const element of form.elements) element.disabled = false;
    document.querySelector("#disconnect").disabled = false;
    updateVisibility();
    status.focus();
  }
});

document
  .querySelector("#check-published")
  .addEventListener("click", async () => {
    if (!savedResult) return;
    const button = document.querySelector("#check-published");
    const publishStatus = document.querySelector("#publish-status");
    button.disabled = true;
    try {
      const response = await fetch(
        siteURL(`songs.json?updated=${Date.now()}`),
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      const published = data.songs.some(
        (song) => song.slug === savedResult.slug && song.id === savedResult.id,
      );
      publishStatus.textContent = published
        ? "サイトへの反映が完了しました。"
        : "まだサイトへ反映されていません。「更新の進行状況」で成功・失敗を確認し、少し待ってから再確認してください。";
      const link = document.querySelector("#song-link");
      link.hidden = !published;
      link.href = siteURL(`songs/${encodeURIComponent(savedResult.slug)}/`);
    } catch {
      publishStatus.textContent =
        "公開サイトの状態を確認できませんでした。接続を確認して再試行してください。";
    } finally {
      button.disabled = false;
    }
  });

document.querySelector("#clear").addEventListener("click", () => {
  if (
    !confirm(
      "この端末の入力内容を消して、新しい楽曲を入力しますか？ 保存済みの楽曲は消えません。",
    )
  )
    return;
  form.reset();
  submissionId = crypto.randomUUID();
  savedResult = null;
  document.querySelector("#result").hidden = true;
  updateVisibility();
  saveDraft();
  message("新しい楽曲を入力してください。");
  form.elements.title.focus();
});
