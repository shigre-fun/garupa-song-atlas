# 複数ゲーム対応とSEOの設計

このサイトはNode.jsでHTMLを静的生成し、ブラウザーのJavaScriptは検索条件に使います。フレームワークやサーバー側APIはありません。

## 設定とデータ

`src/js/site-config.js` がサイト名、公開origin、ベースパス、ゲーム名、表示可能な情報項目、アセット名の設定元です。公開時の `SITE_ORIGIN` と `BASE_PATH` は環境変数で上書きできます。旧 `SITE_BASE_PATH` も受け付けますが、両方指定したときの不一致はエラーになります。内部リンクは `src/js/urls.js`、絶対URLは同ファイルの `absoluteURL` を使います。

ガルパの編集元は `data/garupa/songs.json` です。アワーノーツと同じ `groups` 形式を使い、バンド・種類をグループ、譜面やBPMなどを各曲に置きます。`scripts/catalog.mjs` が共通Songへ変換し、`gameId: "garupa"` と `stableSongId: String(id)` を追加します。`id` は編集・改名で変えず、削除後も再利用しません。別ゲームではゲームIDとstableSongIdを組にして識別します。

アワーノーツの編集元は `data/ournotes/songs.json` です。公式のリリース時楽曲一覧を5バンド×オリジナル／カバーでまとめ、各曲には固定の数値IDを割り当てています。`scripts/catalog.mjs` が共通Songへ変換し、譜面・BPMなど未確認項目は空欄にします。曲名や所属が変わってもIDは変えず、削除後も再利用しません。各グループの `sourceURL` は発表画像、`availableFrom` はゲーム内実装日で、CDや音源の発売日ではありません。新たな公式発表を確認した場合だけ、次の未使用IDを追加します。公開管理画面はなく、両ゲームとも編集元のJSONを修正します。

`data/garupa/legacy-song-paths.json` は移行前の曲名パスを楽曲IDに結び付ける固定記録です。既存の旧パスは消さないでください。ビルドは存在しないID、重複パス、不正なパスを拒否します。新曲には旧URLがないので表への追加は不要です。生成物の `legacy-redirects.json` と `.csv` はドメイン移行時の301転送設定の材料です。

## ページ生成とSEO

`scripts/build.mjs` がトップ、ゲーム別一覧、詳細、情報ページ、404、旧URL案内、sitemap、robotsを生成します。詳細では `src/js/related-songs.js` が版表記を除いた曲名と作曲者を照合し、同じ曲の別譜面や別ゲーム収録先への相互リンクを作ります。ページ本文とheadのメタ情報、パンくず、JSON-LDは同じページ設定から作り、canonicalは常にクエリなしの絶対URLにします。旧URL、404、横断検索の案内はsitemapに含めません。信頼できるページ単位の更新日がないため、sitemapには `lastmod` を出しません。

楽曲一覧の検索・並べ替え・ページング・絞り込みはクエリURLで表現します。GitHub Pagesはクエリ別のレスポンスHTMLやHTTPヘッダーを返せないため、`src/js/query-index.js` が対象条件を含む一覧URLに `noindex,follow` を追加します。通常のHTMLとcanonicalは一覧の基本URLを指します。これはJavaScriptを実行しないクローラーへの完全な制御ではありません。独自ドメイン移行時はCloudflare側でクエリ別のHTTP `X-Robots-Tag` を検討します。

共通画像は `src/images/og-default.png` と `src/images/apple-touch-icon.png` です。図案の再生成用スクリプトは `scripts/assets/create-brand-assets.py` にあります。ゲーム別画像を用意する際は設定の参照先を追加します。

## ブラウザー機能

`src/js/app.js` はゲーム別一覧の条件付き表示、詳細からの条件付き戻り先、旧トップ検索URLの移行を扱います。詳細本文を全曲JSONで描き直しません。各ゲーム一覧の初期50件は静的HTMLです。条件付きURLでは対象ゲームのカタログを取得して描画します。上部ナビとトップの「楽曲一覧を見る」はゲーム別一覧へ直接移動します。
