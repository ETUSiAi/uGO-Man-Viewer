// z_assets/js/utils.js
(() => {
    const U = {};

    // 右ページ側の偶数インデックスを返す（iが奇数なら1つ左に寄せる）
    U.rightEven = (i) => (i % 2 === 0 ? i : i - 1);

    U.clampPage = (i, max) => Math.min(Math.max(i, 0), max);

    U.pctTo01 = (s) => {
        if (typeof s === "number") return s;
        if (typeof s === "string" && s.endsWith("%")) return parseFloat(s) / 100;
        return parseFloat(s);
    };

    U.percentRectToPx = (o, rect) => {
        const l = rect.left + rect.width * Utils.pctTo01(o.left);
        const t = rect.top + rect.height * Utils.pctTo01(o.top);
        const w = rect.width * Utils.pctTo01(o.width);
        const h = rect.height * Utils.pctTo01(o.height);
        return { left: l, top: t, width: w, height: h };
    };

    U.framePercentToPx = (frame, rect) => {
        const fl = rect.left + rect.width * Utils.pctTo01(frame.left ?? 0);
        const ft = rect.top + rect.height * Utils.pctTo01(frame.top ?? 0);
        const fw = rect.width * Utils.pctTo01(frame.width ?? 1);
        const fh = rect.height * Utils.pctTo01(frame.height ?? 1);
        return { left: fl, top: ft, width: fw, height: fh };
    };

    U.polyToClipPathPx = (poly, rect) => {
        return "polygon(" + poly.map(([x, y]) => {
            const fx = parseFloat(x) / 100;
            const fy = parseFloat(y) / 100;
            const px = rect.left + rect.width * fx;
            const py = rect.top + rect.height * fy;
            return `${px}px ${py}px`;
        }).join(", ") + ")";
    };

    U.getImageRect = (containerEl) => {
        const img = containerEl.querySelector("img");
        const ir = img.getBoundingClientRect();
        const cr = containerEl.getBoundingClientRect();
        return {
            left: ir.left - cr.left,
            top: ir.top - cr.top,
            width: ir.width,
            height: ir.height
        };
    };

    U.parseScale = (s) => {
        if (s == null) return 1;
        if (typeof s === "number") return s || 1;
        if (typeof s === "string") {
            const v = s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s);
            return isFinite(v) && v > 0 ? v : 1;
        }
        return 1;
    };

    window.Utils = U;
})();
