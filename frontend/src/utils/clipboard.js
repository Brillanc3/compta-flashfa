/**
 * Clipboard utilities with a legacy fallback for environments where the Async Clipboard API
 * is unavailable or blocked (e.g., inside an iframe with a restrictive Permissions Policy).
 *
 * Target: Chrome 103.
 */

function toStringSafe(value) {
    if (value === null || value === undefined) return "";
    return typeof value === "string" ? value : String(value);
}

function execCommandCopyText(text) {
    const value = toStringSafe(text);
    if (typeof document === "undefined") return false;

    const previousActive = document.activeElement;

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    // Keep it out of view and avoid scroll jumps.
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    // Some browsers need explicit range.
    textarea.setSelectionRange(0, textarea.value.length);

    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }

    document.body.removeChild(textarea);

    // Restore focus.
    if (previousActive && typeof previousActive.focus === "function") {
        try {
            previousActive.focus();
        } catch {
            // ignore
        }
    }

    return ok;
}

function execCommandCopyRich({ html, text }) {
    if (typeof document === "undefined") return false;

    const htmlValue = toStringSafe(html);
    const textValue = toStringSafe(text);

    const previousActive = document.activeElement;
    const selection = window.getSelection?.();

    const container = document.createElement("div");
    container.contentEditable = "true";
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.innerHTML = htmlValue || textValue;
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    const onCopy = (e) => {
        // When execCommand('copy') succeeds, a 'copy' event is fired.
        // We can override the payload to include HTML + plain text.
        try {
            if (!e.clipboardData) return;
            e.clipboardData.setData("text/plain", textValue);
            if (htmlValue) e.clipboardData.setData("text/html", htmlValue);
            e.preventDefault();
        } catch {
            // ignore
        }
    };

    document.addEventListener("copy", onCopy, true);

    let ok = false;
    try {
        container.focus();
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }

    document.removeEventListener("copy", onCopy, true);

    // Cleanup selection & DOM
    try {
        if (selection) selection.removeAllRanges();
    } catch {
        // ignore
    }
    document.body.removeChild(container);

    // Restore focus.
    if (previousActive && typeof previousActive.focus === "function") {
        try {
            previousActive.focus();
        } catch {
            // ignore
        }
    }

    return ok;
}

/**
 * Copy plain text.
 * @returns {Promise<{ok: boolean, method: 'async'|'execCommand'|'unsupported'}>}
 */
export async function copyText(text) {
    const value = toStringSafe(text);
    if (typeof window === "undefined") return { ok: false, method: "unsupported" };

    // Try Async Clipboard API first.
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return { ok: true, method: "async" };
        }
    } catch {
        // Fall back below.
    }

    const ok = execCommandCopyText(value);
    return { ok, method: ok ? "execCommand" : "unsupported" };
}

/**
 * Copy rich content (HTML + text). Falls back to text when rich copy isn't possible.
 * @returns {Promise<{ok: boolean, method: 'async'|'execCommand'|'text-fallback'|'unsupported'}>}
 */
export async function copyHtml({ html, text }) {
    const htmlValue = toStringSafe(html);
    const textValue = toStringSafe(text);
    if (typeof window === "undefined") return { ok: false, method: "unsupported" };

    // Try Async Clipboard API (HTML + plain text).
    try {
        if (
            navigator?.clipboard?.write &&
            typeof window.ClipboardItem !== "undefined" &&
            typeof window.Blob !== "undefined"
        ) {
            await navigator.clipboard.write([
                new window.ClipboardItem({
                    "text/html": new window.Blob([htmlValue], { type: "text/html" }),
                    "text/plain": new window.Blob([textValue], { type: "text/plain" })
                })
            ]);
            return { ok: true, method: "async" };
        }
    } catch {
        // Fall back below.
    }

    // Legacy fallback that often works inside iframes with blocked Async Clipboard.
    const okRich = execCommandCopyRich({ html: htmlValue, text: textValue });
    if (okRich) return { ok: true, method: "execCommand" };

    // Last resort: copy plain text.
    if (textValue) {
        const res = await copyText(textValue);
        return res.ok ? { ok: true, method: "text-fallback" } : { ok: false, method: "unsupported" };
    }

    return { ok: false, method: "unsupported" };
}
