"use strict";

async function popupjs() {
    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    const sendErr = async (errMsg = "") => {
        console.log("人気ウォッチャー ＥＲＲＯＲ:", errMsg);
        await chrome.runtime.sendMessage({
            to: "background",
            code: "show",
            content: "ERR",
            bgcolor: "red",
        });
        return;
    };

    /**
     * timeoutmsまで非同期的にタスク完了を待つ関数
     * @param {string} msg 表示するメッセージ
     * @param {number} timeoutms 最大待ち時間
     * @param {function} task 行うタスク
     */
    const asyncWait = async (msg, timeoutms, task) => {
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
        return false;
    };

    // ビデオ情報抽出ヘルパー 見つかったキャプチャグループの１つ目をとらえる
    String.prototype.extract = function (pattern, undefVal = 0) {
        return this.match(pattern)?.[1]?.replace(/\s/g, "") ?? undefVal;
    };

    // ビデオ視聴回数の値を抽出する関数
    const getViewsVal = (video) => {
        const views = video
            .getAttribute("aria-label")
            .extract(/([\d,]+ 回)視聴/, "0")
            .replace(/[,回]/g, "");
        const viewsVal = views.replace(/[,回]/g, "");
        dlog(viewsVal);
        return viewsVal;
    };

    // ビデオ投稿日を凡その日数に換算した値を抽出する関数
    const getBeforeVal = (video) => {
        const before = video
            .getAttribute("aria-label")
            .extract(/回視聴 (.*前)/, "--前");
        const unitStrings = ["分", "時間", "日", "週", "か月", "年"];
        const units = [0.000694, 0.04, 1, 7, 30, 365];
        let unit;
        for (const i in unitStrings) {
            if (before.indexOf(unitStrings[i]) != -1) {
                unit = units[i];
                break;
            }
        }
        const beforeCoefficient = Number(before.match(/^\d+/)[0]);
        const beforeVal = beforeCoefficient * unit;
        dlog(beforeVal);
        return beforeVal;
    };

    // ビデオ情報string生成関数
    const genVideoInfoRow = (video, infoId) => {
        const url = new URL(
            "https://www.youtube.com" + video.getAttribute("href")
        );
        const title = video.getAttribute("title");
        const ariaLabel = video.getAttribute("aria-label");
        // 今すぐお家でできる１０の凄い実験 作成者: GENKI LABO 632,768 回視聴 3 年前 11 分 8 秒
        const views = ariaLabel.extract(/([\d,]+ 回)視聴/, "--回");
        const durationHour = ariaLabel.extract(/([\d]+) 時間/);
        const durationMinute = ariaLabel.extract(/([\d]+) 分/);
        const durationSec = ariaLabel.extract(/([\d]+) 秒/);
        const before = ariaLabel.extract(/回視聴 (.*前)/, "--前");
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
        const curOut = [infoId, url.href, title, views, when, duration].join(
            "\t"
        );
        // dlog(curOut);
        return curOut;
    };

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // youtube検索結果より動画一覧csvを取得するスクリプト

    let yt_channel_topview = async () => {
        dlog(location.href);

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
        }

        const selectorForVideoMeta =
            "div#content.ytd-rich-item-renderer div#meta a#video-title-link";

        // 一時的に人気ビデオトップ５や最古ビデオを格納する変数
        let videoOldest;
        let videoTop5;
        // 最終的なビデオ情報を格納する変数
        let videoOldestInfo, videoTop5Info;

        // 並び替え前のビデオメタ情報取得
        let videos0;
        let isTaskCompleted = await asyncWait(
            "初期状態の動画リスト取得",
            5000,
            () => {
                videos0 = document.querySelectorAll(selectorForVideoMeta);
                return !!videos0.length;
            }
        );
        if (!isTaskCompleted) return;

        dlog("並び替え前 video0.length:", videos0.length);
        const chk0 = videos0[0].getAttribute("href");
        dlog("並び替え前 video0:", chk0);

        await chrome.runtime.sendMessage({
            to: "background",
            code: "show",
            content: videos0.length.toString(),
            bgcolor: "orange",
        });

        // 並び替えボタン試しに取得してみる
        // 取得できなかったらたぶんビデオの数のせい。
        // ビデオの多寡によってYoutube側の並び替えボタンが使えるかどうかが決まる。
        // おそらく10個ぐらい。

        const selectorTitle = (text) =>
            " yt-formatted-string[title=" + `'${text}'` + "]";

        let canUseSortButton = false;
        await asyncWait("並び替えボタン取得", 500, () => {
            const sortByPopularityBtns = document.querySelector(
                selectorTitle("人気の動画")
            );
            const sortFromOldestBtns = document.querySelector(
                selectorTitle("古い順")
            );
            canUseSortButton = !!sortByPopularityBtns && !!sortFromOldestBtns;
            return !!sortByPopularityBtns && !!sortFromOldestBtns;
        });

        if (!canUseSortButton) canUseSortButton = videos0.length >= 10;
        if (!canUseSortButton) {
            // 動画数が少なくて並び替えボタンがない場合の処理
            // 一番最後の動画が最古動画とみなす。
            // 人気トップ5に関しては自前で並び替えを行う。
            dlog(
                "並び替えボタンがないため",
                "人気ウォッチャー側で並び替えを行います。"
            );

            const largerThanAtViews = (vid1, vid2) => {
                const val1 = getViewsVal(vid1);
                const val2 = getViewsVal(vid2);
                if (val1 < val2) return 1;
                if (val1 > val2) return -1;
                return 0;
            };
            videoTop5 = [...videos0].sort(largerThanAtViews).splice(0, 5);
            dlog("videoTop5 取得完了");
            videoOldest = [...videos0].splice(-1)[0];
            dlog("videoOldest 取得完了");
            // dlog(videoOldest);
            // dlog(videoTop5);
            await chrome.runtime.sendMessage({
                to: "background",
                code: "show",
                content: videos0.length.toString() + "?",
                bgcolor: "aqua",
            });

            videoOldestInfo = genVideoInfoRow(videoOldest, "最古");
            videoTop5Info = videoTop5.map((video, i) =>
                genVideoInfoRow(video, `Top${i + 1}`)
            );
        } else {
            // Youtube側のボタンクリックによる並び替えの処理

            // 指定のラベルのソート方法選択ボタンが押されているか
            const isSelected = (text) =>
                document.querySelector(
                    "yt-chip-cloud-chip-renderer.iron-selected " +
                        selectorTitle(text)
                ) != null;

            // 指定したラベルのソートボタンをクリックして並び替えを待つ関数
            // prevChk が現在値と変わっていたら並び替え終了
            const sortBy = async (text, prevChk) => {
                dlog("isSelected:", isSelected(text));
                if (isSelected(text)) return true;
                if (videos0.length <= 1) return true;

                // ビデオが複数で人気順になっていなければ並び替えを実行
                await document.querySelector(selectorTitle(text)).click();
                // dlog(topviewOrder);

                // 現在のビデオの一番目が最初と同じままなら
                // 並び替えが終わるまで待つ。
                return await asyncWait("sort", 5000, () => {
                    const curChk = document
                        .querySelector(selectorForVideoMeta)
                        .getAttribute("href");
                    if (curChk != prevChk) return true;
                    return false;
                });
            };

            if (!(await sortBy("古い順", chk0))) return;
            videoOldest = document.querySelector(selectorForVideoMeta);
            const chkOldest = videoOldest.getAttribute("href");
            videoOldestInfo = genVideoInfoRow(videoOldest, "最古");

            if (!(await sortBy("人気の動画", chkOldest))) return;

            // ビデオトップ５の情報を取得
            videoTop5 = [
                ...document.querySelectorAll(selectorForVideoMeta),
            ].slice(0, 5);

            dlog(videoTop5.length);
            videoTop5Info = videoTop5.map((video, i) =>
                genVideoInfoRow(video, `Top${i + 1}`)
            );
        }

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

        await asyncWait("find ch about", 5000, getChAbout);
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

        if (!canUseSortButton) {
            // 並び替えボタンを使用しないで処理を行った場合はメッセージを出す。
            dlog(
                [
                    "並び替えボタンがないため",
                    "人気ウォッチャー側で並び替えを行いました。",
                    "アイコンに表示されている水色バッジの数字と",
                    "動画数が一致しているかご確認ください。",
                ].join("\n")
            );
        } else {
            // 並び替えボタンを使用して処理を行った場合は正常終了とする。
            await chrome.runtime.sendMessage({
                to: "background",
                code: "show",
                content: "OK",
                bgcolor: "green",
            });
        }
        return;
    };

    await yt_channel_topview();
}

popupjs();
