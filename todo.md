# todo

-   [x] vidIQ のクローム拡張を ON にしているとコピーがうまくいかないことが頻繁にあるので修正
        原因：channel id を含んだ href を持つ DOM が場合によって存在せず、channel id が取得できない
        処置：二種類の方法で channel id を取得するように修正
