// viewer.js（ナビ・スワイプ・見開き対応・data.js前提）
(() => {
    // 前回表示されていたページ番号の集合
    let __LAST_SHOWN__ = new Set();

    // 指定ページの blob: URL を解放する
    function revokeBlobsForPages(indices) {
        const data = window.__UGOMAN_DATA__;
        if (!data?.pages) return;
        indices.forEach(i => {
            const p = data.pages[i];
            const arr = p && p.__blobs;
            if (Array.isArray(arr) && arr.length) {
                for (const u of arr) {
                    try { URL.revokeObjectURL(u); } catch { }
                }
                p.__blobs = []; // リストも空にしておく
            }
        });
    }
    // 表示用に「相対パス → blob」に解決（ページの __blobs に記録）
    function getResolvedImageForPage(p) {
        const path = (p.kind === "guide" && p.variants)
            ? (/iPhone|iPad|Android/i.test(navigator.userAgent) ? p.variants.sp : p.variants.pc)
            : p.image;
        if (!path) return path;
        p.__blobs = Array.isArray(p.__blobs) ? p.__blobs : [];
        const resolver = window.__UGO_RESOLVE;
        return typeof resolver === "function" ? resolver(path, p.__blobs) : path;
    }

    async function createDecodedImg(src) {
        const IS_MOBILE = /iPhone|iPad|Android/i.test(navigator.userAgent);

        const img = document.createElement("img");
        img.decoding = IS_MOBILE ? "async" : "sync";
        img.loading = "eager";
        img.fetchPriority = "high";
        img.alt = "";
        img.draggable = false;

        // ★ エラー時に即席プレースホルダへ差し替え
        img.onerror = () => {
            try {
                const c = document.createElement("canvas");
                c.width = 800; c.height = 1200;
                const g = c.getContext("2d");
                g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
                g.fillStyle = "#fff"; g.font = "bold 40px system-ui";
                g.textAlign = "center"; g.textBaseline = "middle";
                g.fillText("IMAGE ERROR", c.width / 2, c.height / 2);
                img.src = c.toDataURL("image/png");
            } catch { }
        };

        img.src = src || ""; // 空でも onerror が動く

        const onloadPromise = new Promise((res) => {
            if (img.complete) res(); else img.addEventListener("load", () => res(), { once: true });
        });

        const decodePromise = (typeof img.decode === "function")
            ? img.decode().catch(() => { })
            : Promise.resolve();

        const timeout = new Promise((res) => setTimeout(res, 100));
        await Promise.race([
            decodePromise.then(() => 'decoded'),
            Promise.all([onloadPromise, timeout]).then(() => 'onload')
        ]);

        return img;
    }

    function resolvePageImage(p) {
        if (p.kind === "guide" && p.variants) {
            const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
            return isMobile ? p.variants.sp : p.variants.pc;
        }
        return p.image;
    }

    // ---- 画像プリロード（デコード完了まで待つ版）----
    const __IMG_READY__ = new Map();

    function preloadImage(src) {
        return new Promise((resolve) => {
            if (!src) return resolve();
            if (__IMG_READY__.get(src) === true) return resolve();

            const im = new Image();
            im.decoding = "async";
            im.fetchPriority = "low";
            im.loading = "eager";
            im.onload = () => {
                // decode() は onload 後でも OK（既にデコード済みなら即解決）
                im.decode?.().catch(() => { }).finally(() => {
                    __IMG_READY__.set(src, true);
                    resolve();
                });
            };
            im.onerror = () => resolve();
            im.src = src;
        });
    }

    const data = window.__UGOMAN_DATA__;
    if (!data?.pages?.length) return;

    const viewer = document.getElementById("viewer");

    // 表示モード: auto / single / spread
    const MODES = ["auto", "single", "spread"];

    // 作品ごとの読書位置キー（projectId優先、なければパス）
    const pid = (window.__UGOMAN_DATA__ && window.__UGOMAN_DATA__.projectId)
        ? String(window.__UGOMAN_DATA__.projectId)
        : location.pathname;

    const LS_KEY_MODE = "ugoman.mode";                 // モードは共通でOK
    const LS_KEY_INDEX = `ugoman.lastIndex:${pid}`;     // 読書位置は作品ごとに分離

    let mode = localStorage.getItem(LS_KEY_MODE) || "auto";

    let index = (() => {
        const v = localStorage.getItem(LS_KEY_INDEX);
        const n = v == null ? NaN : Number(v);
        return Number.isFinite(n) ? n : 0;
    })();

    // auto判定：横長なら見開き
    const isSpread = () => {
        if (mode === "spread") return true;
        if (mode === "single") return false;
        return (window.innerWidth / window.innerHeight) > 1.2;
    };

    let __RENDER_TOKEN__ = 0;

    async function render() {
        const token = ++__RENDER_TOKEN__;
        const spread = isSpread();


        // 表示対象インデックスを決定（見開きは右=偶数を基準）
        let showIdx = [];
        if (spread) {
            const rightIdx = Utils.rightEven(index);
            const leftIdx = rightIdx + 1;
            index = rightIdx;

            // ← ガイド例外を入れない。常に [左, 右] で組む（左が無ければ右のみ）
            showIdx = [rightIdx];
            if (leftIdx < data.pages.length) showIdx.unshift(leftIdx); // [左, 右]
        } else {
            index = Utils.clampPage(index, data.pages.length - 1);
            showIdx = [index];
        }
        // ここで前回との差分を計算し、外れたページの blob を解放
        {
            const now = new Set(showIdx);
            const toRevoke = [];
            __LAST_SHOWN__.forEach(i => { if (!now.has(i)) toRevoke.push(i); });
            if (toRevoke.length) revokeBlobsForPages(toRevoke);
            __LAST_SHOWN__ = now;
        }



        // まず表示するページ画像を全てプリロード
        await Promise.all(showIdx.map(i => preloadImage(resolvePageImage(data.pages[i]))));
        if (token !== __RENDER_TOKEN__) return; // 途中で別renderが走ったら無効化

        // 新DOMを裏で構築
        let newRoot = null;
        if (spread) {
            const wrap = Layout.makeSpreadWrap();

            const [leftIdx, rightIdx] = showIdx.length === 2 ? showIdx : [null, showIdx[0]];

            if (leftIdx != null) {
                const leftCell = Layout.makeCell();
                const imgL = await createDecodedImg(getResolvedImageForPage(data.pages[leftIdx]));
                Layout.alignImage(imgL, "left");
                leftCell.appendChild(imgL);
                if (ModeUI.shouldShow(data.pages[leftIdx])) {
                    leftCell.appendChild(ModeUI.el);
                    ModeUI.place(leftCell);
                    ModeUI.bind(leftCell);
                }
                leftCell.style.backgroundColor = "black";
                Overlays.addOverlaysForPage(data, leftIdx, leftCell);
                wrap.appendChild(leftCell);
            }

            {   // 右ページ
                const rightCell = Layout.makeCell();
                const imgR = await createDecodedImg(getResolvedImageForPage(data.pages[rightIdx]));
                Layout.alignImage(imgR, "right");
                rightCell.appendChild(imgR);

                // ModeUI CALL-SITE:BEGIN (right)
                if (!ModeUI.el.isConnected && ModeUI.shouldShow(data.pages[rightIdx])) {
                    rightCell.appendChild(ModeUI.el);
                    ModeUI.place(rightCell);
                    ModeUI.bind(rightCell);
                }
                // ModeUI CALL-SITE:END (right)
                Overlays.addOverlaysForPage(data, rightIdx, rightCell);
                wrap.appendChild(rightCell);
            }

            newRoot = wrap;
        } else {
            const cell = Layout.makeSingleCell();
            const img = await createDecodedImg(getResolvedImageForPage(data.pages[index]));

            cell.appendChild(img);
            Layout.alignImage(img, "center");
            if (ModeUI.shouldShow(data.pages[index])) {
                cell.appendChild(ModeUI.el);
                ModeUI.place(cell);
                ModeUI.bind(cell);
            }
            Overlays.addOverlaysForPage(data, index, cell);
            newRoot = cell;
        }

        viewer.dataset.mode = spread ? "spread" : "single";
        try { localStorage.setItem(LS_KEY_INDEX, String(index)); } catch { }

        // ここで一発置換（空白フレームを作らない）
        Overlays.destroyOverlays();
        viewer.replaceChildren(newRoot);
        ModeUI.updateChecks(mode);
        requestAnimationFrame(() => {
            document.querySelectorAll("#viewer .overlay").forEach(el => {
                el.dispatchEvent(new Event("ugoman:relayout"));
            });
        });
        // 先読み（非同期・待たない）：次だけ
        const prefetch = [];
        if (spread) {
            // 見開き時：次の右ページ（偶数）だけを先読み、左があればその1枚も
            const nextRight = Utils.rightEven(index) + 2;
            if (nextRight < data.pages.length) {
                prefetch.push(preloadImage(resolvePageImage(data.pages[nextRight])));
                if (nextRight + 1 < data.pages.length) {
                    prefetch.push(preloadImage(resolvePageImage(data.pages[nextRight + 1])));
                }
            }
        } else {
            // 単ページ：次のみ
            const next = index + 1;
            if (next < data.pages.length) {
                prefetch.push(preloadImage(resolvePageImage(data.pages[next])));
            }
        }
        Promise.all(prefetch).catch(() => { });

    }

    // 進む/戻る（見開き時は右ページ偶数を保ったまま±2）
    function nextPage() {
        if (isSpread()) {
            index = Utils.rightEven(index) + 2;
        } else {
            index = index + 1;
        }
        index = Utils.clampPage(index, data.pages.length - 1);
        render();
    }
    function prevPage() {
        if (isSpread()) {
            index = Utils.rightEven(index) - 2;
        } else {
            index = index - 1;
        }
        index = Utils.clampPage(index, data.pages.length - 1);
        render();
    }

    // クリック: 左半分=次 / 右半分=戻る（要求どおり）
    viewer.addEventListener("click", (e) => {
        const r = viewer.getBoundingClientRect();
        const x = e.clientX - r.left;
        if (x < r.width * 0.5) nextPage();
        else prevPage();
    });

    // キーボード
    window.addEventListener("keydown", (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.isComposing)) return;
        switch (e.key) {
            case "s":
            case "S":
                e.preventDefault();
                {
                    const i = MODES.indexOf(mode);
                    mode = MODES[(i + 1) % MODES.length];
                    localStorage.setItem(LS_KEY_MODE, mode);
                    // modeBtn.textContent = modeLabel();
                    render();
                }
                break;
            case "ArrowRight":
            case "PageDown":
            case " ":
                e.preventDefault(); prevPage(); break;
            case "ArrowLeft":
            case "PageUp":
                e.preventDefault(); nextPage(); break;
            case "Home":
                index = 0; render(); break;
            case "End":
                index = data.pages.length - 1; render(); break;
        }
    });

    // スワイプ
    // ===== スワイプ判定用パラメータ =====
    const SWIPE_DIST_FRAC = 0.12;   // 画面幅の 12% 以上で候補
    const SWIPE_DIST_MIN = 60;     // 下限(px)
    const SWIPE_DIST_MAX = 220;    // 上限(px)
    const SWIPE_EDGE_PAD = 12;     // 端のエッジジェスチャ除外(px)

    const SWIPE_MAX_TIME = 350;    // ms：これより長いとドラッグ扱い
    const SWIPE_MIN_VELOC = 0.35;   // px/ms：最低速度 ≒ 350px/s
    const SWIPE_ORTHO_RATIO = 1.2;    // 横成分が縦成分より1.2倍以上で有効

    const SWIPE_LONG_TAP = 250;    // ms：長押し判定

    let touch = null;

    viewer.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        touch = {
            sx: t.clientX, sy: t.clientY,
            t0: performance.now(),
            moved: false,
            longTimer: setTimeout(() => { if (touch) touch.longHold = true; }, SWIPE_LONG_TAP),
            edgeBlocked: (t.clientX < SWIPE_EDGE_PAD || t.clientX > window.innerWidth - SWIPE_EDGE_PAD)
        };
    }, { passive: true });

    viewer.addEventListener("touchmove", (e) => {
        if (!touch) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touch.sx;
        const dy = t.clientY - touch.sy;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touch.moved = true;
    }, { passive: true });

    viewer.addEventListener("touchend", (e) => {
        const T = touch; touch = null;
        if (!T) return;
        clearTimeout(T.longTimer);
        if (T.edgeBlocked) return;

        const t = e.changedTouches[0];
        const dx = t.clientX - T.sx;
        const dy = t.clientY - T.sy;
        const dt = Math.max(1, performance.now() - T.t0);
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const v = ax / dt;

        // 画面幅×割合を距離しきい値に、さらに MIN/MAX でクランプ
        const px = Math.round(window.innerWidth * SWIPE_DIST_FRAC);
        const SWIPE_MIN_DIST = Math.min(SWIPE_DIST_MAX, Math.max(SWIPE_DIST_MIN, px));

        if (T.longHold && ax < SWIPE_MIN_DIST * 2) return;

        const isFast = (dt <= SWIPE_MAX_TIME && v >= SWIPE_MIN_VELOC && ax >= SWIPE_MIN_DIST);
        const isHoriz = (ax > ay * SWIPE_ORTHO_RATIO);

        if (isFast && isHoriz) {
            if (dx > 0) nextPage();
            else prevPage();
        }
    }, { passive: true });



    window.addEventListener("resize", render);
    ModeUI.setOnChange((nextMode) => {
        if (!["auto", "single", "spread"].includes(nextMode)) return;
        mode = nextMode;
        try { localStorage.setItem(LS_KEY_MODE, mode); } catch { }
        render();
    });
    render();
})();
