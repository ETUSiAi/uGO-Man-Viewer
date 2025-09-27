// z_assets/js/layout.js
(() => {
    const L = {};

    // 単ページ/見開きの両方で使う「標準セル」
    L.makeCell = () => {
        const cell = document.createElement("div");
        Object.assign(cell.style, {
            width: "50vw",           // 単ページ時は後で 100vw 側がラップ側で効く想定
            height: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            contain: "content paint layout size"
        });
        return cell;
    };
    L.makeSpreadWrap = () => {
        const wrap = document.createElement("div");
        Object.assign(wrap.style, {
            display: "flex",
            width: "100vw",
            height: "100dvh",
            alignItems: "center",
            justifyContent: "center",
            gap: "0"
        });
        return wrap;
    };

    L.makeSingleCell = () => {
        const cell = document.createElement("div");
        Object.assign(cell.style, {
            position: "relative",
            width: "100vw",
            height: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            contain: "content paint layout size"
        });
        return cell;
    };

    // 画像の寄せ方向（左/右/中央）をまとめる
    L.alignImage = (img, side /* 'left'|'right'|'center' */) => {
        if (side === "left") {
            img.style.marginLeft = "auto"; img.style.marginRight = "0";
        } else if (side === "right") {
            img.style.marginRight = "auto"; img.style.marginLeft = "0";
        } else {
            img.style.marginLeft = "auto"; img.style.marginRight = "auto";
        }
    };

    window.Layout = L;
})();
