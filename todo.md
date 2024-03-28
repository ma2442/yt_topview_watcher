# todo

-   [x] vidIQ のクローム拡張を ON にしているとコピーがうまくいかないことが頻繁にあるので修正
        原因：channel id を含んだ href を持つ DOM が場合によって存在せず、channel id が取得できない
        処置：二種類の方法で channel id を取得するように修正
-   [ ] 他ページからからリロードなしで動画ページの Ch 欄から Ch ページを開き、本拡張を動作させると、動画並び替え待ちタイムアウトとなる。
        再現手順：要調査
        原因：動画の並び順として参照しているセレクタ
        "div#content.ytd-rich-item-renderer div#meta a#video-title-link"
        に CH ホームタブの他 CH のおすすめ動画も混じっているためだと思われる。
        （先頭はむしろこれら）
