import { folderName, validateSong } from "./song-schema.js";

export function repositorySettings(input) {
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  const branch = input.branch.trim();
  if (
    !/^[A-Za-z0-9-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repo) ||
    [".", ".."].includes(repo)
  )
    throw new Error("GitHubの所有者とリポジトリ名を確認してください。");
  if (
    !branch ||
    branch.length > 200 ||
    /[\s~^:?*\[\\]/.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{")
  )
    throw new Error("ブランチ名を確認してください。");
  return { owner, repo, branch };
}

// トークンはこのインスタンスのメモリー内だけに置く。保存先はapi.github.comに固定。
export class GitHubStore {
  constructor(settings, token, fetcher = fetch) {
    this.settings = repositorySettings(settings);
    if (!token.trim())
      throw new Error("GitHubのアクセストークンを入力してください。");
    this.token = token.trim();
    this.fetcher = fetcher;
    this.base = `https://api.github.com/repos/${encodeURIComponent(this.settings.owner)}/${encodeURIComponent(this.settings.repo)}`;
  }

  async request(path, method = "GET", body) {
    let response;
    try {
      response = await this.fetcher(this.base + path, {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        "通信を確認できませんでした。入力は保持されています。保存を再試行すると、同じ送信が保存済みか確認します。",
      );
    }
    if (!response.ok) {
      const messages = {
        401: "GitHubの認証に失敗しました。トークンの有効期限を確認してください。",
        403: "書き込み権限、承認状態、またはGitHubの利用上限を確認してください。",
        404: "リポジトリ・ブランチ・初期ファイルが見つかりません。保存先とトークンの対象を確認してください。",
        409: "別の更新と競合しました。もう一度保存してください。既存の更新は上書きしていません。",
        422: "更新できませんでした。同時更新やブランチ保護の可能性があります。設定を確認して再試行してください。",
      };
      const error = new Error(
        messages[response.status] ||
          `GitHubでエラーが発生しました（${response.status}）。入力を保持したまま再試行できます。`,
      );
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async snapshot() {
    const ref = await this.request(
      `/git/ref/heads/${this.settings.branch.split("/").map(encodeURIComponent).join("/")}`,
    );
    const commit = await this.request(`/git/commits/${ref.object.sha}`);
    const tree = await this.request(
      `/git/trees/${commit.tree.sha}?recursive=1`,
    );
    if (tree.truncated)
      throw new Error(
        "リポジトリが大きすぎて安全に一覧を確認できません。保存は行っていません。",
      );
    if (
      !tree.tree.some((x) => x.path === "data/admin-state.json") ||
      !tree.tree.some((x) => x.path === "scripts/build.mjs")
    )
      throw new Error(
        "管理ページ対応版のプロジェクトを先にリポジトリへ配置してください。",
      );
    return { head: ref.object.sha, tree: commit.tree.sha, entries: tree.tree };
  }

  async readJSON(snapshot, path) {
    const entry = snapshot.entries.find(
      (x) => x.path === path && x.type === "blob",
    );
    if (!entry) throw new Error(`${path}が見つかりません。`);
    const blob = await this.request(`/git/blobs/${entry.sha}`);
    if (blob.encoding !== "base64" || blob.size > 100000)
      throw new Error("保存データの形式またはサイズが不正です。");
    const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, "")), (c) =>
      c.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async connect() {
    const repository = await this.request("");
    if (repository.archived || repository.disabled)
      throw new Error("このリポジトリは更新できません。");
    if (repository.permissions && !repository.permissions.push)
      throw new Error("このリポジトリに書き込む権限がありません。");
    await this.snapshot();
    return this.settings;
  }

  async addSong(input, requestedSlug, submissionId) {
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(submissionId))
      throw new Error("送信識別子が不正です。画面を再読み込みしてください。");
    const slug = folderName(requestedSlug || input.title);
    // 入力不備はGitHubへの書き込み前に検出する。
    validateSong({ ...input, id: 1 }, slug);
    const snapshot = await this.snapshot();
    const path = `data/songs/${slug}/song.json`;
    const collision = snapshot.entries.find(
      (x) =>
        x.path.toLowerCase() === path.toLowerCase() ||
        (x.type === "tree" &&
          x.path.toLowerCase() === `data/songs/${slug}`.toLowerCase()),
    );
    if (collision) {
      const existing = await this.readJSON(
        snapshot,
        collision.type === "tree"
          ? collision.path + "/song.json"
          : collision.path,
      );
      if (existing.submissionId === submissionId)
        return {
          slug,
          id: existing.id,
          head: snapshot.head,
          alreadySaved: true,
        };
      throw new Error(
        "同じフォルダー名の楽曲が存在します。別バージョンならフォルダー名を変更してください。",
      );
    }
    const state = await this.readJSON(snapshot, "data/admin-state.json");
    if (
      !Number.isSafeInteger(state.nextId) ||
      state.nextId < 1 ||
      state.nextId >= Number.MAX_SAFE_INTEGER
    )
      throw new Error("管理用の番号データが不正です。");
    const song = { ...input, id: state.nextId, submissionId };
    validateSong(song, slug);
    const nextState = {
      nextId: state.nextId + 1,
      updatedAt: new Date().toISOString(),
    };
    const newTree = await this.request("/git/trees", "POST", {
      base_tree: snapshot.tree,
      tree: [
        {
          path,
          mode: "100644",
          type: "blob",
          content: JSON.stringify(song, null, 2) + "\n",
        },
        {
          path: "data/admin-state.json",
          mode: "100644",
          type: "blob",
          content: JSON.stringify(nextState, null, 2) + "\n",
        },
      ],
    });
    const commit = await this.request("/git/commits", "POST", {
      message: `Add song: ${song.title}`,
      tree: newTree.sha,
      parents: [snapshot.head],
    });
    // force:false により、別端末からの更新を破壊せず競合を知らせる。
    await this.request(
      `/git/refs/heads/${this.settings.branch.split("/").map(encodeURIComponent).join("/")}`,
      "PATCH",
      { sha: commit.sha, force: false },
    );
    return { slug, id: song.id, head: commit.sha, alreadySaved: false };
  }
}
