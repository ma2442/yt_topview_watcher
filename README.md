# 人気ウォッチャー

    www.youtube.com/@~~~~/videos の形式のYoutubeページにて、チャンネル情報と最古、人気順トップの動画情報を取得しTAB区切りcsvの形でクリップボードにコピーします。
    エクセルに貼り付けての分析がはかどります。

## バージョン履歴

-   v0.3.0 youtube チャンネルページの DOM 構造変更に伴う修正
-   v0.2.5 並び替えタイムアウトで想定のエラー終了をしない挙動を修正
-   v0.2.4 「人気の動画」「古い順」の並び替えボタンが使えないぐらい少ない動画本数のチャンネルでも動画を自前で並び替えて情報取得する機能追加
-   v0.2.2 動画取得タイミングが早すぎると並び替え動作前にサイレント終了するバグを修正
-   v0.2.1 channel id がたまに取得できない問題を修正
-   v0.2.0 コピー機能を最古の動画も含めて行うように変更
-   v0.1.0 Ch と人気順トップ 5 の動画の属性をクリップボードへコピーする機能実装
