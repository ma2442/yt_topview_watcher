"use strict";

async function popupjs() {
    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    // timeoutmsまで非同期的にタスク完了を待つ関数
    let asyncWait = async (msg, timeoutms, task) => {
        dlog(msg, "start");
        for (let t = 0; t <= timeoutms; t += 200) {
            if (task()) {
                dlog(msg, ": COMPLETED");
                return true;
            }
            dlog(msg, ": in progress,", t, "msec");
            await new Promise((ok) => setTimeout(ok, 200));
        }
        sendErr(msg + ": T I M E O U T !");
    };

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // youtube検索結果より動画一覧csvを取得するスクリプト

    let yt_channel_topview = async () => {
        dlog(location.href);
        const sendErr = async (errMsg = "") => {
            console.log("人気ウォッチャー ＥＲＲＯＲ:", errMsg);
            await chrome.runtime.sendMessage({
                to: "background",
                code: "show",
                content: "ERR",
            });
            return;
        };

        if (location.host !== "www.youtube.com") {
            sendErr("Not Youtube Page");
            return;
        }

        // チャンネルページ内で動画タブ以外を開いているとき
        // 動画タブをクリック
        const chTabSelected = document.querySelector(
            ".yt-tab-shape-wiz__tab--tab-selected"
        );
        if (!chTabSelected) {
            sendErr("tabs in ch page is not found");
            return;
        }
        dlog("tabselected is found");
        if (chTabSelected.textContent != "動画") {
            dlog("tabselected is not 動画");
            const chTabs = document.querySelectorAll(".yt-tab-shape-wiz__tab");
            for (const chTab of chTabs) {
                if (chTab.textContent == "動画") {
                    chTab.click();
                }
            }
            await new Promise((ok) => setTimeout(ok, 200));
        }

        const selectorForVideoMeta =
            "div#content.ytd-rich-item-renderer div#meta a#video-title-link";

        // 並び替え前のビデオメタ情報取得
        const videos0 = document.querySelectorAll(selectorForVideoMeta);
        // ビデオが一つもないなら終了
        if (videos0 == null) return;
        const chk0 = videos0[0].getAttribute("href");

        const selectorTitle = (text) =>
            " yt-formatted-string[title=" + `'${text}'` + "]";

        // 指定のラベルのソート方法選択ボタンが押されているか
        const isSelected = (text) =>
            document.querySelector(
                "yt-chip-cloud-chip-renderer.iron-selected " +
                    selectorTitle(text)
            ) != null;

        // 指定したラベルのソートボタンをクリックして並び替えを待つ関数
        // prevChk が現在値と変わっていたら並び替え終了
        const sortBy = async (text, prevChk) => {
            if (isSelected(text)) return;
            if (videos0.length == 1) return;

            // ビデオが複数で人気順になっていなければ並び替えを実行
            await document.querySelector(selectorTitle(text)).click();
            // dlog(topviewOrder);

            // 現在のビデオの一番目が最初と同じままなら
            // 並び替えが終わるまで待つ。
            await asyncWait("sort", 10000, () => {
                const curChk = document
                    .querySelector(selectorForVideoMeta)
                    .getAttribute("href");
                if (curChk != prevChk) return true;
                return false;
            });
        };

        // ビデオ情報string生成関数
        //
        const genVideoInfo = (video, infoId) => {
            const url = new URL(
                "https://www.youtube.com" + video.getAttribute("href")
            );
            const title = video.getAttribute("title");
            const ariaLabel = video.getAttribute("aria-label");

            // 今すぐお家でできる１０の凄い実験 作成者: GENKI LABO 632,768 回視聴 3 年前 11 分 8 秒

            const extract = (pattern, undefVal = 0) =>
                ariaLabel.match(pattern)?.[1].replace(/\s/g, "") ?? undefVal;
            const views = extract(/([\d,]+ 回)視聴/, "--回");
            const durationHour = extract(/([\d]+) 時間/);
            const durationMinute = extract(/([\d]+) 分/);
            const durationSec = extract(/([\d]+) 秒/);
            const before = extract(/回視聴 (.*前)/, "--前");
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            const date = today.getDate();
            const when = `${before}(${year}/${month}/${date}より)`;
            const duration =
                durationHour +
                ":" +
                ("00" + durationMinute).slice(-2) +
                ":" +
                ("00" + durationSec).slice(-2);

            const curOut = [
                infoId,
                url.href,
                title,
                views,
                when,
                duration,
            ].join("\t");
            // dlog(curOut);
            return curOut;
        };

        await sortBy("古い順", chk0);
        const videoOldest = document.querySelector(selectorForVideoMeta);
        const chkOldest = videoOldest.getAttribute("href");
        const videoOldestInfo = genVideoInfo(videoOldest, "最古");

        await sortBy("人気の動画", chkOldest);

        // ビデオトップ５の情報を取得
        const videoTop5 = [
            ...document.querySelectorAll(selectorForVideoMeta),
        ].slice(0, 5);

        dlog(videoTop5.length);

        const videoTop5Info = videoTop5.map((video, i) =>
            genVideoInfo(video, `Top${i + 1}`)
        );

        // 概要DOMを生成（チャンネル概要を開いて閉じることで）
        const chAboutBtn = document.querySelector(
            "div#content.ytd-channel-tagline-renderer"
        );
        chAboutBtn.click();
        await new Promise((ok) => setTimeout(ok, 200));
        chAboutBtn.click();

        // チャンネル概要から情報取得
        const getChAbout = () =>
            document.querySelector(
                "div#additional-info-container table.ytd-about-channel-renderer"
            );

        await asyncWait("find ch about", 10000, getChAbout);
        const chAbout = getChAbout();

        // カスタムＵＲＬおよびChannel ID 取得

        // channelIDを取得する関数(チャンネルページで)
        // vidIdのエクステンションが原因か、DOM構造でchIdのありかが変わる。
        const getChId = () => {
            let que = 'link[href*="youtube.com/channel/"]';
            let chIdHolder = document.querySelector(que);
            if (chIdHolder) return chIdHolder.href.split("/").splice(-1)[0];

            que = '[href^="/channel/"][href$="/about"]';
            chIdHolder = document.querySelector(que);
            if (chIdHolder) return chIdHolder.href.split("/").splice(-2)[0];

            sendErr("chIdHolder is not found!");
            return undefined;
        };

        const customUrl = document.querySelector(
            "yt-formatted-string#channel-handle"
        ).textContent;

        if (!customUrl) sendErr("customUrl is not found!");

        const chId = getChId();
        dlog("customUrl, chId:", customUrl);

        const { subscriberCount, videoCount, viewCount, publishedAt } = [
            ...chAbout.querySelectorAll("tr>td:nth-child(2)"),
        ].reduce((acc, x) => {
            const str = x.textContent.replace(/\s/g, "");
            return {
                subscriberCount:
                    acc?.subscriberCount ??
                    str.match(/チャンネル登録者数(.+人)/)?.[1],
                videoCount: acc?.videoCount ?? str.match(/(.+本)の動画/)?.[1],
                viewCount: acc?.viewCount ?? str.match(/(.+回)視聴/)?.[1],
                publishedAt: acc?.publishedAt ?? str.match(/(.+)に登録/)?.[1],
            };
        }, {});
        dlog(subscriberCount, videoCount, viewCount, publishedAt);

        const title = document
            .querySelector("yt-formatted-string#text.ytd-channel-name")
            .textContent.trim();

        const chInfo = [
            "ch",
            title,
            subscriberCount,
            viewCount,
            "https://www.youtube.com/" + customUrl + "/videos",
            videoCount,
            publishedAt,
            chId,
        ].join("\t");
        dlog(chInfo);

        ////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////

        // 先頭にBOM("\ufeff")をつけておく
        const output =
            "\ufeff" + [chInfo, ...videoTop5Info, videoOldestInfo].join("\n");
        dlog(output);

        // クリップボードへコピー
        await navigator.clipboard.writeText(output);
        await chrome.runtime.sendMessage({
            to: "background",
            code: "show",
            content: "OK",
        });
        return;
    };

    await yt_channel_topview();
}

popupjs();
