import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import ElectronicSignatureBlock, {
    buildContractSignatureSections,
    CONTRACT_SIGNATURE_CONFIRMATION_TEXT,
    ELECTRONIC_SIGNATURE_TOKEN,
    ELECTRONIC_SIGNATURE_TOKENS,
    ElectronicSignaturePendingBlock,
    signatureToHtml,
} from "@/components/contracts/ElectronicSignatureBlock";

const A4_WIDTH = 794;
const A4_HEIGHT = Math.round(A4_WIDTH * 1.4142);
const SIGNATURE_BLOCK_ESTIMATED_HEIGHT = 380;

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export default function A4Preview({
                                      markdown = "",
                                      backgroundImageUrl = "",
                                      onHtmlChange = null,
                                      contract = null,
                                      signatureRequiredText = CONTRACT_SIGNATURE_CONFIRMATION_TEXT,
                                      onAfterAction = null,
                                  }) {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [pages, setPages] = useState([]);

    const effectiveRequiredText = useMemo(() => {
        const normalized = String(signatureRequiredText || "").trim().toLowerCase();
        if (!normalized || normalized === "lu et approuver") {
            return CONTRACT_SIGNATURE_CONFIRMATION_TEXT;
        }
        return CONTRACT_SIGNATURE_CONFIRMATION_TEXT;
    }, [signatureRequiredText]);

    const isSignatureToken = (value) => {
        const token = String(value || "").trim();
        return ELECTRONIC_SIGNATURE_TOKENS.includes(token);
    };

    const signatureSections = useMemo(
        () => buildContractSignatureSections(contract),
        [contract]
    );

    const effectiveMarkdown = useMemo(() => {
        const source = String(markdown || "");
        const alreadyContainsToken = ELECTRONIC_SIGNATURE_TOKENS.some((token) => source.includes(token));

        if (!contract || alreadyContainsToken) {
            return source;
        }

        const trimmed = source.trimEnd();
        return trimmed ? `${trimmed}\n\n${ELECTRONIC_SIGNATURE_TOKEN}\n` : `${ELECTRONIC_SIGNATURE_TOKEN}\n`;
    }, [contract, markdown]);

    const splitBlocks = (md) => {
        const source = String(md || "");
        if (!source.trim()) return [""];
        return source.split(/\n{2,}/);
    };

    useEffect(() => {
        const blocks = splitBlocks(effectiveMarkdown);
        const temp = document.createElement("div");

        temp.style.width = `${A4_WIDTH - 80}px`;
        temp.style.position = "absolute";
        temp.style.visibility = "hidden";
        temp.style.zIndex = "-1";

        document.body.appendChild(temp);

        const pagesOut = [];
        let current = [];
        let currentHeight = 0;

        const flush = () => {
            pagesOut.push(current.join("\n\n"));
            current = [];
            currentHeight = 0;
        };

        for (const block of blocks) {
            const trimmedBlock = String(block || "").trim();
            let blockHeight = 0;

            if (isSignatureToken(trimmedBlock)) {
                blockHeight = SIGNATURE_BLOCK_ESTIMATED_HEIGHT;
            } else {
                temp.innerHTML = "";
                const measured = document.createElement("div");
                measured.style.fontSize = "16px";
                measured.style.lineHeight = "1.4";
                measured.innerHTML = block;
                temp.appendChild(measured);
                blockHeight = temp.scrollHeight;
            }

            if (current.length > 0 && currentHeight + blockHeight > A4_HEIGHT - 120) {
                flush();
            }

            current.push(block);
            currentHeight += blockHeight;
        }

        if (current.length === 0) {
            current.push("");
        }

        flush();
        document.body.removeChild(temp);

        setPages(pagesOut);
    }, [effectiveMarkdown]);

    useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;
            const maxWidth = containerRef.current.clientWidth;
            setScale(Math.min(maxWidth / A4_WIDTH, 1));
        };

        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);

    useEffect(() => {
        if (!onHtmlChange) return;

        const finalHtml = pages
            .map((pageContent) => {
                const lines = String(pageContent || "").split("\n");
                const body = lines
                    .map((line) => {
                        const trimmedLine = line.trim();

                        if (isSignatureToken(trimmedLine)) {
                            if (!contract) return "";
                            return signatureToHtml({
                                contractId: contract?.id,
                                sections: signatureSections,
                                status: contract?.status || "PENDING",
                                refusalReason: contract?.refusalReason || null,
                            });
                        }

                        return `<p>${escapeHtml(line)}</p>`;
                    })
                    .join("");

                return `
          <div style="page-break-after: always; font-family: Arial; font-size: 14px;">
            ${body}
          </div>
        `;
            })
            .join("\n");

        onHtmlChange(finalHtml);
    }, [contract, onHtmlChange, pages, signatureSections]);

    const dims = useMemo(() => {
        const safeScale = Math.max(0.2, Math.min(scale, 1));
        return {
            pageW: Math.round(A4_WIDTH * safeScale),
            pageH: Math.round(A4_HEIGHT * safeScale),
            pad: Math.round(40 * safeScale),
            footerOffset: Math.round(24 * safeScale),
            fontSize: Math.max(10, Math.round(16 * safeScale)),
            footerFont: Math.max(9, Math.round(12 * safeScale)),
        };
    }, [scale]);

    const mdComponents = useMemo(() => ({
        p: ({ children, ...props }) => {
            const flattened = React.Children.toArray(children)
                .filter((child) => typeof child === "string")
                .join("")
                .trim();

            if (isSignatureToken(flattened)) {
                if (!contract) return null;

                if (contract.status === "PENDING") {
                    return (
                        <ElectronicSignaturePendingBlock
                            contract={contract}
                            requiredText={effectiveRequiredText}
                            onAfterAction={onAfterAction}
                        />
                    );
                }

                return (
                    <ElectronicSignatureBlock
                        contractId={contract?.id || null}
                        sections={signatureSections}
                        status={contract?.status || "PENDING"}
                        refusalReason={contract?.refusalReason || null}
                    />
                );
            }

            return <p {...props}>{children}</p>;
        },
    }), [contract, effectiveRequiredText, onAfterAction, signatureSections]);

    return (
        <div ref={containerRef} className="max-h-[75vh] overflow-y-auto overflow-x-hidden py-6">
            <div className="mx-auto" style={{ width: `${dims.pageW}px` }}>
                {pages.map((pageContent, index) => (
                    <div
                        key={index}
                        className="relative mx-auto bg-white shadow-lg"
                        style={{
                            width: `${dims.pageW}px`,
                            minHeight: `${dims.pageH}px`,
                            padding: `${dims.pad}px`,
                            backgroundImage: backgroundImageUrl
                                ? `linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), url('${backgroundImageUrl}')`
                                : "none",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                            backgroundSize: "auto",
                        }}
                    >
                        <div
                            className="prose prose-slate max-w-none text-black"
                            style={{ fontSize: `${dims.fontSize}px`, lineHeight: 1.4 }}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
                                {pageContent}
                            </ReactMarkdown>
                        </div>

                        <div
                            className="absolute text-slate-500 opacity-60"
                            style={{
                                bottom: `${dims.footerOffset}px`,
                                right: `${dims.footerOffset}px`,
                                fontSize: `${dims.footerFont}px`,
                            }}
                        >
                            Page {index + 1}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
