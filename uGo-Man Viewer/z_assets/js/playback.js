// z_assets/js/playback.js
(() => {
    const P = {};

    /**
     * 動画の再生制御（表示/非表示・ended時の処理）を付与する
     * @param {HTMLVideoElement} v   再生対象の <video>
     * @param {HTMLElement} ov       表示レイヤ（.overlay）
     * @param {HTMLElement} mk       マーカー（.marker）
     * @param {() => ("loop"|"hold"|"hide"|"reset")} getEndMode  終了モードを都度取得
     * @param {() => void} doLayout  再生直前にフレーム配置を確定させるコールバック
     */
    P.attachBasicControls = (v, ov, mk, getEndMode, doLayout) => {
        const ensurePlay = () => {
            doLayout();
            v.style.visibility = "visible";
            v.play().catch(() => { });
            if (mk) mk.style.display = "none";
        };

        const showAndPlay = () => {
            ov.style.display = "block";
            if (v.readyState < 1 || !v.videoWidth || !v.videoHeight) {
                const once = () => { v.removeEventListener("loadedmetadata", once); ensurePlay(); };
                v.addEventListener("loadedmetadata", once);
                requestAnimationFrame(() => {
                    if (v.videoWidth && v.videoHeight) ensurePlay();
                });
            } else {
                ensurePlay();
            }
        };

        const hideAndReset = () => {
            v.pause();
            v.currentTime = 0;
            ov.style.display = "none";
            if (mk) mk.style.display = "block";
        };

        const toggle = () => {
            const cur = getComputedStyle(ov).display;
            if (cur === "none") showAndPlay();
            else hideAndReset();
        };

        // クリック・タップでのトグル実装用に返す
        const handlers = {
            toggle,
            onEnded: () => {
                const endMode = String(getEndMode() ?? "reset").toLowerCase();
                switch (endMode) {
                    case "loop":
                        // v.loop を true にする場合は呼び出し側でセット（状況に応じて）
                        break;
                    case "hold":
                        // そのまま最後のフレームで停止（UIだけ戻すならここで切替）
                        break;
                    case "hide":
                        v.pause();
                        try { v.currentTime = 0; } catch { }
                        ov.style.display = "none";
                        if (mk) mk.style.display = "block";
                        break;
                    default: // reset
                        hideAndReset();
                        break;
                }
            }
        };

        // 一応の初期状態
        ov.style.display = "none";
        v.style.visibility = "hidden";

        return handlers;
    };

    window.Playback = P;
})();
