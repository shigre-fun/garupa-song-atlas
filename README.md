# ガルパ楽曲ノート

楽曲情報を手動で編集し、静的なウェブサイトを生成するプロジェクトです。
収録データはゲーム等で確認しながら修正してください。

- [公開サイト](https://shigre-fun.github.io/garupa-song-atlas/)
- [スマホから楽曲を追加する管理ページ](https://shigre-fun.github.io/garupa-song-atlas/admin/)

## 最初の準備

Node.js 22以上をインストールし、このフォルダーで `npm install` を実行します。
pnpmを使用する場合は `pnpm install` でも構いません。

## 既存の楽曲を修正する

スマホからは[管理ページ](https://shigre-fun.github.io/garupa-song-atlas/admin/)に接続し、「曲の一覧を取得・更新」→曲を検索・選択→「選んだ曲を読み込む」→「変更を保存する」で修正できます。URLと管理IDは維持し、他端末で同じ曲が変更されていた場合は上書きを停止します。詳細は[管理ページの手順](docs/ADMIN.md)を参照してください。

以下はPCでファイルを直接修正する手順です。

1. `data/songs/楽曲名/song.json` をテキストエディターで開きます。
2. 数値や文字列を修正して、UTF-8で保存します。
3. `node scripts/build.mjs` を実行します。
4. `node scripts/serve.mjs` を実行し、ブラウザーで `http://127.0.0.1:4173` を開きます。

例：`data/songs/Yes! BanG_Dream!/song.json`。フォルダー名に使えない記号はハイフンになっています。同名曲はバンド名等で区別します。
読みやすいローマ字名への変更も可能です。フォルダー名を変えるとページURLも変わります。
`id` は重複を避けるための管理番号なので、既存曲の番号はそのままにしてください。

## 新曲を追加する

スマホからは、公開サイトの `admin/` にある管理ページへ入力して追加できます。GitHubへの保存とサイトの自動更新に対応しています。初回の接続・公開設定は [スマホ管理ページの手順](docs/ADMIN.md) を参照してください。

以下はPCでファイルを直接追加する場合の手順です。

```powershell
node scripts/add-song.mjs "新しい楽曲名"
```

ローマ字のフォルダー名を指定する場合：

```powershell
node scripts/add-song.mjs "新しい楽曲名" "atarashii-kyoku"
```

作成された `song.json` の空欄を埋め、ビルドします。管理番号は自動で割り当てられます。
元のひな型は `templates/song.json`、各項目の説明は `templates/README.md` にあります。
未入力のレベル・ノーツ数や重複した番号は、生成時にエラーで知らせます。
更新日は `data/settings.json` の `updatedAt` にISO形式で入力します。

## ファイルの役割

| 場所                              | 内容                             |
| --------------------------------- | -------------------------------- |
| `data/songs/楽曲名/song.json`     | 編集する楽曲データ               |
| `src/template.html`               | 全ページ共通の検索欄・ヘッダー等 |
| `src/views.js`                    | 一覧と詳細ページの表示           |
| `src/domain.js`                   | 検索・並べ替え                   |
| `src/app.js`                      | ブラウザーでの画面処理           |
| `src/style.css`、`src/mobile.css` | デザイン                         |
| `scripts/`                        | 生成・新曲追加・ローカル確認     |
| `dist/`                           | 自動生成した公開用ファイル       |

`dist` を直接編集すると再生成で上書きされます。必ず `data` または `src` を編集してください。
データを外部から取得して上書きする処理はありません。

## 検証・公開ファイルの作成

```powershell
node scripts/build.mjs
node --test tests/*.test.mjs
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

最後のコマンドで `garupa-song-atlas.zip` を作成します。ZIPの中身、または `dist` の中身を静的サイトの公開先に配置します。通常はサイトのルートで配信します。GitHub Pagesではワークフローがサブフォルダーに対応したビルドと公開を行います。
Netlify向けの設定は `netlify.toml` にあります。コードの整形には `npm run format` を使えます。
