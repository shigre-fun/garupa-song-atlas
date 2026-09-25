# 公開先と独自ドメイン移行

## 現在のGitHub Pages

GitHub Actionsは `src/js/site-config.js` の現在の公開originとPagesの `BASE_PATH=/garupa-song-atlas/` を使ってビルドします。公開URLは `https://shigre-fun.github.io/garupa-song-atlas/` です。ローカルのルート公開を試すときは `BASE_PATH=/` を指定してください。`node scripts/serve.mjs` は同じ設定のベースパスで生成した `dist/` を配信します。

`dist/robots.txt` はサブパス内に置かれます。GitHub Pagesのリポジトリサイトはドメイン直下のrobots.txtを管理できないため、このファイルだけでサイト全体のクロール規則を指定できません。`/garupa-song-atlas/sitemap.xml` は直接開けるので、必要に応じてSearch Consoleへ送信してください。検索条件付き一覧のnoindexはブラウザー側のheadスクリプトで設定されます。JavaScriptを使わないクローラーの挙動は保証できません。

## Cloudflare Pagesと独自ドメインへの移行

1. 決定したドメインをCloudflare Pagesへ接続し、DNS・TLS・公開先を確認する。ビルドコマンドは `node scripts/build.mjs && node --test tests/*.test.mjs`、公開ディレクトリは `dist`。
2. 公開環境に `SITE_ORIGIN=https://決定したドメイン` と `BASE_PATH=/` を設定する。仮URLを前提にした `SITE_BASE_PATH` が残っていれば消す。ビルド後、canonical・OGP・sitemap・アセット・管理画面のURLを確認する。
3. `legacy-redirects.csv` またはJSONの全行を使い、旧ドメインの曲名パスから新ドメインの数値IDパスへの恒久転送を設定する。旧トップの検索条件付きURLもガルパ一覧へ条件を引き継ぐ。旧ドメインを維持できない場合は転送できないため、その制約を公開前に確認する。サイト内の旧案内ページは補助として残す。
4. 新ドメイン直下の `robots.txt` と `sitemap.xml` を確認し、Search Consoleに新プロパティとsitemapを登録する。Cloudflare側でクエリ付き一覧に `X-Robots-Tag: noindex, follow` を返す設定を検討し、基本URL・楽曲詳細には付かないことを実URLで確認する。
5. Cloudflare Pagesの404がHTTP 404になること、未知の楽曲IDをトップHTMLへ書き換えないことを確認する。公開されたHTML/CSS/JavaScriptをrobots.txtでブロックしない。
6. 管理画面のGitHub保存先と公開確認を実際のリポジトリ・ブランチでテストする。独自ドメインへ移るとブラウザーのoriginが変わり、旧originのローカルストレージにある下書きは自動移行されない。必要な下書きは移行前に控え、アクセストークンは新originで再入力する。
7. 新旧URLの転送と索引状況を確認し、旧サイトの公開・転送を十分な期間維持する。

今回の作業ではドメインが未決定のためDNSや旧ドメインの301設定は行いません。Cloudflare Pagesでは `dist/404.html` を使って未知URLを404で返す構成とし、SPAフォールバックを設定しないでください。
