import React from 'react';
import { Text, Range, Transforms, Node } from 'slate';

// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_VALUE = [{ type: 'paragraph', children: [{ text: '' }] }];

// eslint-disable-next-line react-refresh/only-export-components
export function safeValue(v) {
    return Array.isArray(v) && v.length > 0 ? v : EMPTY_VALUE;
}

// eslint-disable-next-line react-refresh/only-export-components
export function serialize(value) {
    const v = safeValue(value);
    return v.map((n) => Node.string(n)).join('\n');
}

// eslint-disable-next-line react-refresh/only-export-components
export function deserialize(text) {
    return [{ type: 'paragraph', children: [{ text: text || '' }] }];
}

// eslint-disable-next-line react-refresh/only-export-components
export function decorateMarkdown([node, path]) {
    if (!Text.isText(node)) return [];
    const text = node.text;
    const ranges = [];

    const pushTriplet = ({ start, end, tokenLen, mark }) => {
        if (end - start <= tokenLen * 2) return;
        ranges.push({ anchor: { path, offset: start }, focus: { path, offset: start + tokenLen }, syntax: 'before' });
        ranges.push({ anchor: { path, offset: start + tokenLen }, focus: { path, offset: end - tokenLen }, [mark]: true });
        ranges.push({ anchor: { path, offset: end - tokenLen }, focus: { path, offset: end }, syntax: 'after' });
    };

    const patterns = [
        { re: /\*\*([\s\S]+?)\*\*/g, tokenLen: 2, mark: 'bold' },
        { re: /__([\s\S]+?)__/g, tokenLen: 2, mark: 'underline' },
        { re: /~~([\s\S]+?)~~/g, tokenLen: 2, mark: 'strike' },
        { re: /(^|[^*])\*([\s\S]+?)\*(?!\*)/g, tokenLen: 1, mark: 'italic', italicPrefixGroup: true },
    ];

    for (const p of patterns) {
        let m;
        while ((m = p.re.exec(text)) !== null) {
            if (p.italicPrefixGroup) {
                const prefix = m[1] || '';
                const content = m[2] || '';
                if (!content) continue;
                const start = m.index + prefix.length;
                pushTriplet({ start, end: start + 1 + content.length + 1, tokenLen: 1, mark: 'italic' });
            } else {
                pushTriplet({ start: m.index, end: m.index + m[0].length, tokenLen: p.tokenLen, mark: p.mark });
            }
        }
    }
    return ranges;
}

export function Leaf({ attributes, children, leaf }) {
    let className = '';
    if (leaf.syntax) className += ' text-cca-textSecondary/40 select-none';
    else className += ' text-cca-textPrimary';
    if (leaf.bold) className += ' font-semibold';
    if (leaf.italic) className += ' italic';
    if (leaf.underline) className += ' underline';
    if (leaf.strike) className += ' line-through';
    return <span {...attributes} className={className}>{children}</span>;
}

export function Element({ attributes, children }) {
    return <div {...attributes} className="whitespace-pre-wrap break-words">{children}</div>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function isHotkey(e, combo) {
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const alt = e.altKey;
    const shift = e.shiftKey;
    if (combo === 'ctrl+b') return ctrl && !alt && !shift && key === 'b';
    if (combo === 'ctrl+i') return ctrl && !alt && !shift && key === 'i';
    if (combo === 'ctrl+u') return ctrl && !alt && !shift && key === 'u';
    if (combo === 'ctrl+shift+x') return ctrl && !alt && shift && key === 'x';
    return false;
}

// eslint-disable-next-line react-refresh/only-export-components
export function wrapWithToken(editor, token) {
    const sel = editor.selection;
    if (!sel) return;
    if (Range.isCollapsed(sel)) {
        Transforms.insertText(editor, token + token);
        Transforms.move(editor, { distance: token.length, unit: 'character', reverse: true });
        return;
    }
    const [start, end] = Range.edges(sel);
    Transforms.insertText(editor, token, { at: end });
    Transforms.insertText(editor, token, { at: start });
}
