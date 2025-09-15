// z_assets/js/overlays.js
(() => {
    const O = {};

    function addOverlaysForPage(data, pageIndex, containerEl) {
        const p = data.pages[pageIndex];
        if (!p?.overlays?.length) return;
        if (!containerEl.style.position) containerEl.style.position = "relative";
        p.__blobs = Array.isArray(p.__blobs) ? p.__blobs : [];
        const sink = p.__blobs;
        p.overlays.forEach(o => buildOverlayElements(o, containerEl, sink));
    }

    function destroyOverlays() {
        document.querySelectorAll("#viewer .overlay, #viewer .hotspot, #viewer .marker").forEach(div => {
            const v = div.querySelector?.("video");
            if (v) {
                try { v.pause(); } catch { }
                try { v.removeAttribute("src"); } catch { }
                try { v.load(); } catch { }         // src解除を反映させて参照を切る
                try { v.currentTime = 0; } catch { }
            }
            div.remove();
        });
    }

    // （overlays.js 内、makeOverlayUpdater の“上”に貼る）
    const PANEL_BORDER_PX = 3;                    // 作品ごとに合わせる
    const MARKER_MARGIN_PX = PANEL_BORDER_PX * 1; // 左下マージン
    const DOT_SIZE_PX = PANEL_BORDER_PX;          // ドット一辺
    const DOT_GAP_PX = Math.round(PANEL_BORDER_PX * 1); // ドット間隔

    // 追加：polyの底辺に沿って左下へ置く
    function placeMarkerStackPoly(mk, poly, rect) {
        // poly[%] → px
        const pts = poly.map(([x, y]) => {
            const fx = parseFloat(x) / 100, fy = parseFloat(y) / 100;
            return {
                x: rect.left + rect.width * fx,
                y: rect.top + rect.height * fy
            };
        });

        // 底辺候補＝「yが大きい点」2つを採用
        const sorted = pts.slice().sort((a, b) => b.y - a.y);
        const pA = sorted[0], pB = sorted[1];

        // 左下（xが小さい方）をLB、もう一方をRBとする
        const LB = (pA.x <= pB.x) ? pA : pB;
        const RB = (LB === pA) ? pB : pA;

        // 底辺方向ベクトル e（正規化）
        const ex = RB.x - LB.x, ey = RB.y - LB.y;
        const elen = Math.hypot(ex, ey) || 1;
        const ux = ex / elen, uy = ey / elen;

        // 内側への法線 n：画面上方向（yマイナス）を優先
        let nx = -uy, ny = ux;
        if (ny > 0) { nx = -nx; ny = -ny; } // 上向きに反転

        // 縁からのマージン
        const margin = MARKER_MARGIN_PX;
        const totalH = 3 * DOT_SIZE_PX + 2 * DOT_GAP_PX;

        // 角から「底辺方向に margin」、「内側に margin」だけ入った位置に、
        // 縦積みドットの“上端”を置く（上に totalH ぶん伸びる）
        const bx = LB.x + ux * margin + nx * margin;
        const by = LB.y + uy * margin + ny * margin;

        mk.style.left = Math.round(bx) + "px";
        mk.style.top = Math.round(by - totalH) + "px";
        mk.style.setProperty("--dot-size", DOT_SIZE_PX + "px");
        mk.style.setProperty("--dot-gap", DOT_GAP_PX + "px");
    }

    function placeMarkerStackFixed(mk, framePx) {
        const totalH = 3 * DOT_SIZE_PX + 2 * DOT_GAP_PX;
        const x = Math.round(framePx.left + MARKER_MARGIN_PX);
        const y = Math.round(framePx.top + framePx.height - totalH - MARKER_MARGIN_PX);
        mk.style.left = x + "px";
        mk.style.top = y + "px";
        mk.style.setProperty("--dot-size", DOT_SIZE_PX + "px");
        mk.style.setProperty("--dot-gap", DOT_GAP_PX + "px");
    }

    function layoutVideo(o, rect, v) {
        if (!v.videoWidth || !v.videoHeight) return;

        const frame = Utils.framePercentToPx(o.frame ?? {}, rect);

        const c = Array.isArray(o.center) ? o.center : ["50%", "50%"];
        const cx = frame.left + frame.width * Utils.pctTo01(c[0] ?? "50%");
        const cy = frame.top + frame.height * Utils.pctTo01(c[1] ?? "50%");

        const frameAR = frame.width / frame.height;
        const videoAR = v.videoWidth / v.videoHeight;

        let vw, vh;
        if (frameAR < 1) { // 縦長: 高さフィット
            vh = frame.height;
            vw = vh * videoAR;
        } else {           // 横長: 幅フィット
            vw = frame.width;
            vh = vw / videoAR;
        }


        const dataScale = Utils.parseScale(o.scale);

        Object.assign(v.style, {
            position: "absolute",
            width: vw + "px",
            height: vh + "px",
            left: (cx - vw / 2) + "px",
            top: (cy - vh / 2) + "px",
            transformOrigin: "center center",
            transform: `rotate(${o.rotate || 0}deg) scale(${dataScale})`
        });

        window.__UGOMAN_DEV__?.afterLayout?.(o, frame, v);
    }

    function makeOverlayUpdater(o, containerEl, hot, ov, mk) {

        const update = () => {
            if (!containerEl.isConnected) return;
            const img = containerEl.querySelector("img");
            if (!img) return;
            const rect = Utils.getImageRect(containerEl); // 画像の表示領域
            if (Array.isArray(o.poly) && o.poly.length >= 3) {
                const clipPx = Utils.polyToClipPathPx(o.poly, rect);
                hot.style.clipPath = clipPx;
                hot.style.webkitClipPath = clipPx;
                ov.style.clipPath = clipPx;
                ov.style.webkitClipPath = clipPx;
                // polyの場合は hot/ov はフルサイズ(セル全体)のままでOK（clipで切る）
                hot.style.left = "0"; hot.style.top = "0"; hot.style.width = "100%"; hot.style.height = "100%";
                ov.style.left = "0"; ov.style.top = "0"; ov.style.width = "100%"; ov.style.height = "100%";
            } else if (o.left != null) {
                // 矩形（%）→ px にして直接位置とサイズを設定
                const rpx = Utils.percentRectToPx(o, rect);
                Object.assign(hot.style, {
                    left: rpx.left + "px",
                    top: rpx.top + "px",
                    width: rpx.width + "px",
                    height: rpx.height + "px",
                    clipPath: "none", webkitClipPath: "none"
                });
                Object.assign(ov.style, {
                    left: rpx.left + "px",
                    top: rpx.top + "px",
                    width: rpx.width + "px",
                    height: rpx.height + "px",
                    clipPath: "none", webkitClipPath: "none"
                });
            }
            if (mk) {
                const framePx = Utils.framePercentToPx(o.frame ?? {}, rect);
                if (Array.isArray(o.poly) && o.poly.length >= 3) {
                    placeMarkerStackPoly(mk, o.poly, rect);   // ← polyに沿って配置
                } else {
                    placeMarkerStackFixed(mk, framePx);       // ← 既存の矩形用
                }
            }
        };

        // 画像ロード後に一度、かつリサイズでも更新
        const img = containerEl.querySelector("img");
        if (img) {
            if (img.complete) update();
            else img.addEventListener("load", update, { once: true });
        } else {
            // 念のため
            requestAnimationFrame(update);
        }

        // コンテナのサイズ変化監視（見開き/回転でも効く）
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(update);
            ro.observe(containerEl);
        }
        window.addEventListener("resize", update);

        return update; // 必要なら呼び出し元で再呼び出しも可能
    }

    function buildOverlayElements(o, containerEl, sink) {
        //const usePoly = Array.isArray(o.poly) && o.poly.length >= 3;

        // クリック判定用
        const hot = document.createElement("div");
        hot.className = "hotspot";

        // 表示レイヤ（clip-pathを適用する土台）
        const ov = document.createElement("div");
        ov.className = "overlay";
        ov.style.visibility = "hidden";

        const mk = document.createElement("div");
        mk.className = "marker";
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement("div");
            dot.className = "dot";
            mk.appendChild(dot);
        }

        // 動画
        const v = document.createElement("video");
        v.style.visibility = "hidden";
        v.style.willChange = "transform";
        ov.style.willChange = "clip-path";

        // ★ ここを変更：相対パス → blob: を“いま”解決し、p.__blobs（= sink）に記録
        const resolver = window.__UGO_RESOLVE;
        const resolvedVideo = (typeof resolver === "function") ? resolver(o.video, sink) : o.video;
        v.src = resolvedVideo;

        function showVideoPlaceholder(label = "VIDEO NOT FOUND") {
            ov.style.display = "block";
            ov.style.visibility = "visible";
            ov.style.background = "rgba(255,0,0,0.15)";
            const ph = document.createElement("div");
            ph.textContent = label;
            Object.assign(ph.style, {
                position: "absolute",
                left: "50%", top: "50%",
                transform: "translate(-50%,-50%)",
                font: "bold 16px system-ui",
                color: "#fff",
                padding: "6px 10px",
                border: "1px solid rgba(255,255,255,0.6)",
                borderRadius: "6px",
                backdropFilter: "blur(2px)"
            });
            ov.appendChild(ph);
            if (mk) mk.style.display = "block";
        }

        if (!resolvedVideo) {
            showVideoPlaceholder("MISSING: " + (o.video || "(unknown)"));
        }
        /*
        v.addEventListener("error", () => {
            showVideoPlaceholder("ERROR: " + (o.video || "(video)"));
        });*/

        v.muted = true;
        v.playsInline = true;
        v.preload = "metadata";
        ov.appendChild(v);

        // 初期サイズは0にしておく（doLayoutで正しいサイズに上書きされる）
        v.style.width = "0px";
        v.style.height = "0px";

        // Playback へ委譲
        const ctl = Playback.attachBasicControls(
            v,
            ov,
            mk,
            () => endMode,
            () => doLayout()
        );
        v.addEventListener("ended", ctl.onEnded);
        // クリック/タップでトグル（ページ送りへは伝播させない）
        const onClickToggle = (e) => { e.stopPropagation(); ctl.toggle(); };
        hot.addEventListener("click", onClickToggle);
        ov.addEventListener("click", onClickToggle);

        // スワイプ優先（距離のみでタップ判定）
        let sx, sy;
        const onTS = (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; };
        const onTE = (e) => {
            const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
            const TAP = 16;
            if (Math.abs(dx) < TAP && Math.abs(dy) < TAP) {
                e.stopPropagation();
                e.preventDefault();
                ctl.toggle();
                return;
            }
            // それ以外（スワイプ等）は親へ伝播
        };
        hot.addEventListener("touchstart", onTS, { passive: false });
        hot.addEventListener("touchend", onTE, { passive: false });
        ov.addEventListener("touchstart", onTS, { passive: false });
        ov.addEventListener("touchend", onTE, { passive: false });

        // DOMに追加（clip-path 適用のため ov/hot はセル全体サイズ）
        containerEl.appendChild(hot);
        containerEl.appendChild(ov);
        containerEl.appendChild(mk);

        // 画像実寸に追随して clip-path と座標を更新する updater
        const updater = makeOverlayUpdater(o, containerEl, hot, ov, mk);

        // 動画メタデータが読めたら配置（frame/scale/center/rotate）
        const doLayout = () => {
            const img = containerEl.querySelector("img");
            if (!img || !img.complete) {
                img?.addEventListener("load", doLayout, { once: true });
                return;
            }
            const rect = Utils.getImageRect(containerEl);
            if (!rect.width || !rect.height) {
                requestAnimationFrame(doLayout);
                return;
            }
            layoutVideo(o, rect, v);
            ov.style.visibility = "visible";
        };
        ov.addEventListener("ugoman:relayout", doLayout);

        v.addEventListener("loadedmetadata", doLayout);
        if (v.readyState >= 1) doLayout();
        requestAnimationFrame(doLayout);

        const endMode = String(o.end ?? "reset").toLowerCase().trim();
        v.loop = (endMode === "loop");
    }
    O.addOverlaysForPage = addOverlaysForPage;
    O.destroyOverlays = destroyOverlays;
    O.makeOverlayUpdater = makeOverlayUpdater;
    O.buildOverlayElements = buildOverlayElements;
    window.Overlays = O;
})();
