"use strict";

async function backgroundjs() {
    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    // 拡張のアイコンクリックしたら収集情報をコピー
    chrome.action.onClicked.addListener(async (tab) => {
        const tabs = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });

        let url = new URL(tabs[0].url);

        // chrome:// や edge:// , chromewebstoreなどの特殊なページではなにもしない。
        if (
            !["http:", "https:", "file:"].includes(url.protocol) ||
            /chromewebstore.google.com/.test(url.host)
        )
            return;

        chrome.action.setBadgeText({ text: "wait" });
        chrome.action.setBadgeBackgroundColor({
            color: "orange",
        });

        await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["scripting.js"],
        });
    });

    chrome.runtime.onMessage.addListener(
        async ({ to, code, content, bgcolor }) => {
            if (to === "background" && code === "show") {
                await chrome.action.setBadgeText({ text: content });
                await chrome.action.setBadgeBackgroundColor({
                    color: bgcolor,
                });

                await new Promise((ok) => setTimeout(ok, 30000));
                await chrome.action.setBadgeText({ text: "" });
            }
        }
    );
}

backgroundjs();
