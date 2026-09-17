# スマホから楽曲を追加する

[管理ページを開く](https://shigre-fun.github.io/garupa-song-atlas/admin/)。スマホのブラウザーでブックマークして使えます。

保存先は所有者 `shigre-fun`、リポジトリ `garupa-song-atlas`、ブランチ `main` です。公開サイトから開くと自動設定されます。

## 最初の接続

1. GitHubのSettings → Developer settings → Personal access tokens → Fine-grained tokensを開きます。
2. トークンの対象をこのサイトのリポジトリだけに限定します。
3. Repository permissionsのContentsをRead and writeにして作成します。Workflows権限は楽曲の追加には不要です。
4. 管理ページで保存先とトークンを入力し、「接続する」を押します。

トークンは管理ページのメモリー内だけに保持します。画面を再読み込みすると再接続が必要です。GitHubへの通信にだけ使用し、下書き・Gitのファイル・公開用データには保存しません。

## 日常の追加操作

1. 曲名、カタカナ読み、種類、バンド、配信日時を入力します。エクストラの相手や合同バンドは「参加アーティスト・他バンド」に入力します。
2. 作曲者、原曲アーティスト、作品名、3Dライブ対応状況などを入力します。未確認の任意情報は空欄のままでも保存できます。
3. 実装済みの難易度にチェックし、レベル・ノーツ数を入力します。
4. 「楽曲を保存する」を押します。入力内容はGitHubに曲別JSONとして保存されます。
5. 「更新の進行状況」でGitHub Actionsを確認します。更新が成功したら「サイトへの反映を確認」を押して楽曲ページを開けます。

保存処理と公開処理は別です。GitHubに保存できても、自動更新が失敗すると公開サイトへは反映されません。エラー時はActionsのログを確認してください。
PCの電源を入れる必要はありません。スマホとGitHubがオンラインであれば保存・更新できます。

## 入力の復元と再試行

- 入力途中のデータは、そのブラウザーのローカルストレージに自動保存します。他端末との下書き同期は行いません。
- シークレットモード、ブラウザーのデータ削除、保存容量の制限では下書きを保持できない場合があります。保存に失敗した場合は画面上に表示します。
- 保存中の通信切断では、入力を変えずに再試行すると同じ送信がすでに保存されているか確認します。
- 同時更新があった場合は既存データを上書きせず停止します。もう一度保存すると最新の番号で再試行します。
- 同名の別バージョンを追加する場合は「ページのフォルダー名を指定する」で区別してください。既存曲の上書きはこの画面では行いません。

## GitHub Pagesの初期設定

1. プロジェクトをGitHubリポジトリのmainへ配置します。`src/`、`scripts/`、`data/songs/`、`data/settings.json`、`data/admin-state.json`、`.github/workflows/pages.yml` 等が必要です。
2. リポジトリのSettings → Pages → Build and deployment → SourceをGitHub Actionsにします。
3. Actionsの「Publish song atlas」を実行します。以後mainへの保存で自動更新します。
4. Pagesで表示されるURLを開きます。管理画面の所有者・リポジトリはビルド時に自動設定されます。

初回配置をGitで行う認証と、スマホの管理画面に入力するトークンは別に設定できます。トークンをチャットやGitファイルへ貼り付けないでください。

## PCで後から編集する場合

スマホからの保存はGitHub上のコミットになるため、PCでは先に `git pull --ff-only` で取り込んでから編集してください。
管理用番号は `data/admin-state.json` の `nextId` で採番し、楽曲ファイルと同じコミットで更新します。既存の追加コマンドもこの番号を更新します。
手動で曲を増やした場合は `nextId` を全曲のIDより大きくしてください。ビルド時に重複と採番の整合性を検証します。

GitHub Pagesのサブフォルダー配信では `SITE_BASE_PATH=/リポジトリ名` を指定してビルドします。Actionsでは自動設定されます。通常のローカル確認やルート配信では指定不要です。

## 実装に使用した公式仕様

- [GitHub REST APIのブラウザーからの利用](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)
- [Git参照の更新とforce指定](https://docs.github.com/en/rest/git/refs)
- [GitHub Pagesのカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
