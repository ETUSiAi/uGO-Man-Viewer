// z_assets/js/modeui.js
(() => {
    const M = {};

    // 単一DOM（1個だけ運用）
    const el = document.createElement("div");
    Object.assign(el.style, {
        position: "absolute",
        zIndex: 20,
        color: "#fff",
        borderRadius: "6px",
        fontSize: "14px",
        lineHeight: "1.6",
        userSelect: "none"
    });

    function makeCB(name, value) {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.name = name;
        cb.value = value;
        cb.style.marginRight = "8px";
        cb.style.display = "block";
        cb.style.width = "100px";
        cb.style.height = "100px";
        cb.style.accentColor = "#000088";
        el.appendChild(cb);
        return cb;
    }

    const cbAuto = makeCB("mode", "auto");
    const cbSingle = makeCB("mode", "single");
    const cbSpread = makeCB("mode", "spread");

    const shouldShow = (p) => !!p && p.kind === "guide" && !!p.variants;
    /*
    // P000_1_pc/sp だけ表示
    const shouldShow = (p) => {
        if (!p || p.kind !== "guide") return false;
        const src = (p.variants ? (/iPhone|iPad|Android/i.test(navigator.userAgent) ? p.variants.sp : p.variants.pc) : p.image) || "";
        return /\/P000_1_(pc|sp)\.jpg$/i.test(src) || /\/P000_1_/.test(src);
    };*/

    const CB_POS = {
        auto: { left: 0.3, top: 0.1875 },
        single: { left: 0.3, top: 0.305 },
        spread: { left: 0.3, top: 0.4225 }
    };

    function place(containerEl) {
        const rect = Utils.getImageRect(containerEl);
        Object.assign(el.style, {
            left: rect.left + "px",
            top: rect.top + "px",
            width: rect.width + "px",
            height: rect.height + "px"
        });

        function placeOne(cb, pos) {
            const CB_SCALE = 0.05;
            const size = rect.height * CB_SCALE;
            cb.style.position = "absolute";
            cb.style.width = size + "px";
            cb.style.height = size + "px";
            cb.style.left = (rect.width * pos.left) + "px";
            cb.style.top = (rect.height * pos.top) + "px";
            cb.style.transform = "translate(-50%,-50%)";
            cb.style.transformOrigin = "center center";
        }

        placeOne(cbAuto, CB_POS.auto);
        placeOne(cbSingle, CB_POS.single);
        placeOne(cbSpread, CB_POS.spread);
    }

    let ro = null;
    function bind(containerEl) {
        if (ro) { ro.disconnect(); ro = null; }

        const run = () => place(containerEl);

        const img = containerEl.querySelector("img");
        if (img) {
            if (img.complete) run();
            else img.addEventListener("load", run, { once: true });
        }

        if (window.ResizeObserver) {
            ro = new ResizeObserver(run);
            ro.observe(containerEl);
        }
        window.addEventListener("resize", run, { once: true });
    }

    // 伝播抑止（ラッパーは透過、入力だけ当たり判定ON）
    el.style.pointerEvents = "none";           // ← UIラッパーを“面で”無効化
    el.style.touchAction = "manipulation";     // ← ブラウザ標準ジェスチャ干渉を抑制
    el.setAttribute("tabindex", "-1");         // ← フォーカス奪取の回避

    const clickables = el.querySelectorAll('input, label, button');
    clickables.forEach((elm) => {
        elm.style.pointerEvents = "auto";        // ← 入力要素だけ有効化
        // UI内のイベントはバブリング止める（preventDefaultはしない）
        elm.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        elm.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
        elm.addEventListener('click', (e) => e.stopPropagation());
    });

    // 外から渡されるハンドラ（viewer.js側で setMode→render）
    let onChange = null;
    function set(next) { if (onChange) onChange(next); }

    cbAuto.addEventListener("change", () => set("auto"));
    cbSingle.addEventListener("change", () => set("single"));
    cbSpread.addEventListener("change", () => set("spread"));

    // 公開API
    M.el = el;                                   // DOM本体（append先で使う）
    M.shouldShow = shouldShow;                   // (p) => boolean
    M.place = place;                             // (containerEl)
    M.bind = bind;                               // (containerEl)
    M.updateChecks = (mode) => {                 // (mode)
        cbAuto.checked = (mode === "auto");
        cbSingle.checked = (mode === "single");
        cbSpread.checked = (mode === "spread");
    };
    M.setOnChange = (fn) => { onChange = fn; };  // (nextMode) => void

    window.ModeUI = M;
})();
