# バンドリ楽曲ノート

ガルパとアワーノーツの楽曲情報を手動で編集し、静的なウェブサイトを生成するプロジェクトです。アワーノーツには、公式発表でリリース時の実装が確認できた78曲を登録しています。
収録データはゲーム等で確認しながら修正してください。

新URLとSEOの設計は[構成資料](docs/ARCHITECTURE.md)、公開先・独自ドメイン移行は[公開手順](docs/DEPLOYMENT.md)を参照してください。

BPM（基本・下限・上限）とゲーム内演奏時間も編集できます。BPM順・演奏時間順の定義と既存曲の調査方法は[BPMと演奏時間](docs/SONG_TIMING.md)を参照してください。

一覧では難易度（初期EXPERT）と並べ方を別々に選びます。レベル順・ノーツ数順は選択した難易度を使用し、他の並べ方は難易度に影響されません。選択中の並べ方ボタンを押すたびに通常順（▲）と逆順（▼）を切り替えます。レベル・ノーツ数・BPM・時間は初回選択で大きいものから表示し、未実装・未確認は常に最後です。

- [公開サイト](https://shigre-fun.github.io/garupa-song-atlas/)
- [ガルパ楽曲一覧](https://shigre-fun.github.io/garupa-song-atlas/garupa/songs/)
- [スマホから楽曲を追加する管理ページ](https://shigre-fun.github.io/garupa-song-atlas/admin/)

## 最初の準備

Node.js 22以上をインストールし、このフォルダーで `npm install` を実行します。
pnpmを使用する場合は `pnpm install` でも構いません。

## 既存の楽曲を修正する

スマホからは[管理ページ](https://shigre-fun.github.io/garupa-song-atlas/admin/)に接続し、「曲の一覧を取得・更新」→曲を検索・選択→「選んだ曲を読み込む」→「変更を保存する」で修正できます。URLと管理IDは維持し、他端末で同じ曲が変更されていた場合は上書きを停止します。詳細は[管理ページの手順](docs/ADMIN.md)を参照してください。

以下はPCでファイルを直接修正する手順です。

1. `data/garupa/songs.json` をテキストエディターで開き、対象曲の `id` を探します。
2. 曲固有の項目を修正し、UTF-8で保存します。バンドと種類はその曲が属するグループで管理します。
3. `node scripts/build.mjs` を実行します。
4. `node scripts/serve.mjs` を実行し、ブラウザーで `http://127.0.0.1:4173` を開きます。GitHub Pagesと同じサブパスで試す場合は `BASE_PATH=/garupa-song-atlas/` を設定してビルドとサーバーを起動します。

曲名が同じ場合も `id` で区別します。既存曲のバンドや種類を変更する場合は、曲のオブジェクトを正しいグループへ移してください。
旧曲名URLの互換情報は `data/garupa/legacy-song-paths.json` に固定してあります。
`id` は恒久URLにも使う管理番号です。既存曲の番号は変更・再利用しないでください。URLは `/garupa/songs/{id}/` です。

アワーノーツの追加・修正は `data/ournotes/songs.json` で行います。公式発表でゲーム内実装を確認してから、該当バンド・種類のグループに未使用IDと曲名を追加してください。IDは恒久URL `/ournotes/songs/{id}/` に使うため、曲名変更後も保持します。バンド、種類、実装日、出典URLを確認し、未確認のBPM・譜面情報は推測して入力しません。現在の管理画面はガルパ専用です。

## 新曲を追加する

スマホからは、公開サイトの `admin/` にある管理ページへ入力して追加できます。GitHubへの保存とサイトの自動更新に対応しています。初回の接続・公開設定は [スマホ管理ページの手順](docs/ADMIN.md) を参照してください。

以下はPCでファイルを直接追加する場合の手順です。

```powershell
node scripts/add-song.mjs "新しい楽曲名"
```

追加された曲を `data/garupa/songs.json` のIDで探し、グループのバンドと曲の空欄を埋めてからビルドします。管理番号は自動で割り当てられます。
元のひな型は `templates/song.json`、各項目の説明は `templates/README.md` にあります。
未入力のレベル・ノーツ数や重複した番号は、生成時にエラーで知らせます。
更新日は `data/settings.json` の `updatedAt` にISO形式で入力します。

## ファイルの役割

| 場所                                    | 内容                           |
| --------------------------------------- | ------------------------------ |
| `data/garupa/songs.json`                | ガルパの楽曲データ             |
| `data/ournotes/songs.json`              | アワーノーツの確認済み楽曲     |
| `data/garupa/legacy-song-paths.json`    | 旧曲名URLと恒久IDの対応        |
| `data/garupa/song-timing-research.json` | BPM・演奏時間の調査固有情報    |
| `src/js/`                               | 共通設定・表示・検索・管理画面 |
| `src/pages/`                            | ページのHTMLひな型             |
| `src/styles/`                           | 画面のCSS                      |
| `src/images/`                           | サイト画像とアイコン           |
| `src/static/`                           | 公開先用の静的設定             |
| `scripts/`                              | 生成・新曲追加・ローカル確認   |
| `scripts/research/`、`scripts/assets/`  | 調査・画像生成の補助ツール     |
| `scripts/qa/`                           | 生成物の監査                   |
| `reports/`                              | 自動生成した品質レポート       |
| `dist/`                                 | 自動生成した公開用ファイル     |

`dist` を直接編集すると再生成で上書きされます。必ず `data` または `src` を編集してください。
データを外部から取得して上書きする処理はありません。
過去の取得資料はローカルの `archive/legacy-acquisition-2026-09-25.zip` に保管し、現行ビルドには使用しません。

## 検証・公開ファイルの作成

```powershell
node scripts/build.mjs
node --test tests/*.test.mjs
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

最後のコマンドで `garupa-song-atlas.zip` を作成します。ZIPの中身、または `dist` の中身を静的サイトの公開先に配置します。通常はサイトのルートで配信します。GitHub Pagesではワークフローがサブフォルダーに対応したビルドと公開を行います。
Netlify向けの設定は `netlify.toml` にあります。コードの整形には `npm run format` を使えます。
