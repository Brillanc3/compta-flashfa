import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function isEnabled() {
    try {
        const qs = new URLSearchParams(window.location.search);
        if (qs.get("debugNav") === "1") return true;
        return localStorage.getItem("debugNav") === "1";
    } catch {
        return false;
    }
}

function now() {
    return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function cssNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function getOverlayCandidates() {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    const nodes = Array.from(document.querySelectorAll("body *"));
    const overlays = [];

    for (const el of nodes) {
        // skip obvious non-elements
        if (!(el instanceof HTMLElement)) continue;

        const cs = window.getComputedStyle(el);
        const pos = cs.position;
        if (pos !== "fixed" && pos !== "sticky") continue;

        const rect = el.getBoundingClientRect();
        const coversMost =
            rect.width >= vw * 0.85 &&
            rect.height >= vh * 0.85 &&
            rect.left <= vw * 0.1 &&
            rect.top <= vh * 0.1;

        if (!coversMost) continue;

        const z = cssNum(cs.zIndex) ?? 0;
        const pe = cs.pointerEvents;
        const op = parseFloat(cs.opacity || "1");
        const vis = cs.visibility;
        const disp = cs.display;

        // On garde même les overlays "invisibles" (opacity 0)
        overlays.push({
            el,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            className: (el.className || "").toString().slice(0, 200) || null,
            role: el.getAttribute("role"),
            ariaModal: el.getAttribute("aria-modal"),
            zIndex: z,
            pointerEvents: pe,
            opacity: op,
            visibility: vis,
            display: disp,
            rect: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
        });
    }

    overlays.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    return overlays.slice(0, 12);
}

function topElementAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!(el instanceof HTMLElement)) return null;
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: (el.className || "").toString().slice(0, 200) || null,
        role: el.getAttribute("role"),
        zIndex: cssNum(cs.zIndex),
        pointerEvents: cs.pointerEvents,
        opacity: parseFloat(cs.opacity || "1"),
        visibility: cs.visibility,
        rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        },
    };
}

function dumpGlobalState(label) {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const body = document.body;

    const bodyCS = window.getComputedStyle(body);
    const htmlCS = window.getComputedStyle(document.documentElement);

    const center = topElementAt(Math.round(vw / 2), Math.round(vh / 2));
    const overlays = getOverlayCandidates();

    console.groupCollapsed(
        `%c[debugNav] ${label} @ ${now()}`,
        "color:#93c5fd;font-weight:600"
    );

    console.log("location:", window.location.href);
    console.log("activeElement:", document.activeElement);
    console.log("body:", {
        overflow: bodyCS.overflow,
        pointerEvents: bodyCS.pointerEvents,
    });
    console.log("html:", {
        overflow: htmlCS.overflow,
        pointerEvents: htmlCS.pointerEvents,
    });
    console.log("centerTopElement:", center);
    console.log("overlayCandidates(top):", overlays);

    // “inert” / aria-hidden peuvent bloquer
    const inertCount = document.querySelectorAll("[inert]").length;
    const ariaHiddenCount = document.querySelectorAll('[aria-hidden="true"]').length;
    console.log("inertCount:", inertCount, "ariaHiddenTrueCount:", ariaHiddenCount);

    console.groupEnd();
}

export default function DebugNavProbe() {
    const enabled = useMemo(() => isEnabled(), []);
    const location = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        if (!enabled) return;

        // 1) Log route change + dump état global
        console.log(
            `%c[debugNav] route => ${location.pathname}${location.search}${location.hash} (${navType})`,
            "color:#86efac;font-weight:600"
        );
        dumpGlobalState("after-route-change");
    }, [enabled, location, navType]);

    useEffect(() => {
        if (!enabled) return;

        // 2) Patch history pour voir qui appelle push/replace
        const origPush = history.pushState;
        const origReplace = history.replaceState;

        history.pushState = function (...args) {
            console.log("%c[debugNav] history.pushState", "color:#fbbf24", args);
            return origPush.apply(this, args);
        };

        history.replaceState = function (...args) {
            console.log("%c[debugNav] history.replaceState", "color:#fbbf24", args);
            return origReplace.apply(this, args);
        };

        // 3) Capture clicks pour voir si un overlay mange l’UI
        const onPointerDown = (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            console.log(
                "%c[debugNav] pointerdown",
                "color:#fca5a5;font-weight:600",
                {
                    tag: t.tagName.toLowerCase(),
                    id: t.id || null,
                    className: (t.className || "").toString().slice(0, 120) || null,
                    path: e.composedPath?.()?.slice(0, 6) || null,
                }
            );
            // dump immédiat si tu veux plus verbeux
            // dumpGlobalState("after-pointerdown");
        };

        const onKeyDown = (e) => {
            if (e.key === "Escape") dumpGlobalState("escape-pressed");
        };

        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown, true);

        // 4) Observer DOM pour détecter apparition d’un overlay/backdrop invisible
        const mo = new MutationObserver((mutations) => {
            // Heuristique: si un gros ajout/removal se produit, dump.
            let big = false;
            for (const m of mutations) {
                if (m.addedNodes?.length || m.removedNodes?.length) {
                    big = true;
                    break;
                }
            }
            if (big) dumpGlobalState("dom-mutation");
        });

        mo.observe(document.body, { childList: true, subtree: true });

        // API debug manuelle
        window.__debugNav = {
            dump: (label = "manual-dump") => dumpGlobalState(label),
            overlays: () => getOverlayCandidates(),
        };

        console.log(
            "%c[debugNav] enabled. Use localStorage.debugNav='1' or ?debugNav=1. Manual: window.__debugNav.dump()",
            "color:#93c5fd"
        );

        return () => {
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown, true);
            mo.disconnect();

            history.pushState = origPush;
            history.replaceState = origReplace;

            delete window.__debugNav;
        };
    }, [enabled]);

    return null;
}
