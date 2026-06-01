// /frontend/src/components/inventory/InventoryTable.jsx

import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Table d'affichage de l'inventaire — Glass Premium
 */
export default function InventoryTable({ data = [] }) {
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
                <p className="text-sm font-bold uppercase tracking-widest text-cca-textSecondary">
                    Aucun résultat trouvé
                </p>
            </div>
        );
    }

    return (
        <div className="relative overflow-x-auto glass-scroll rounded-2xl">
            <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">

                {/* HEADER */}
                <thead className="sticky top-0 z-10 bg-cca-surface/60 backdrop-blur-2xl">
                    <tr>
                        <Th>Objet</Th>
                        <Th>Quantité</Th>
                        <Th>Mouvement</Th>
                        <Th>Opérateur</Th>
                        <Th>Emplacement</Th>
                        <Th>Horodatage</Th>
                    </tr>
                </thead>

                {/* BODY */}
                <tbody className="divide-y divide-cca-border/30">
                    {data.map((row) => (
                        <tr
                            key={row.id}
                            className="
                                group transition-all duration-300
                                hover:bg-brand-primary/5 hover:backdrop-blur-sm
                            "
                        >

                            {/* OBJET */}
                            <Td>
                                <div className="flex flex-col">
                                    <span className="font-black tracking-tight text-cca-textPrimary">
                                        {row.itemLabel || row.itemCode}
                                    </span>
                                    <span className="text-[10px] font-bold text-cca-textSecondary/50 uppercase tracking-tighter">
                                        {row.itemCode}
                                    </span>
                                </div>
                            </Td>

                            {/* QUANTITE */}
                            <Td>
                                <span className="font-black text-lg text-cca-textPrimary">
                                    {row.quantity}
                                </span>
                            </Td>

                            {/* TYPE */}
                            <Td>
                                {row.type === "ADD" ? (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        + Ajout
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                        − Retrait
                                    </span>
                                )}
                            </Td>

                            {/* UTILISATEUR */}
                            <Td>
                                <div className="flex items-center gap-3">
                                    {row.user?.imageUrl ? (
                                        <img
                                            src={row.user.imageUrl}
                                            alt="avatar"
                                            className="h-8 w-8 rounded-xl object-cover border border-cca-border shadow-sm group-hover:scale-110 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="
                                            h-8 w-8 rounded-xl bg-cca-base text-cca-textSecondary
                                            flex items-center justify-center text-[10px] font-black border border-cca-border
                                        ">
                                            {getInitials(row.user?.name || row.properName)}
                                        </div>
                                    )}

                                    <span className="font-bold text-xs">
                                        {row.user?.name ||
                                            row.properName ||
                                            <span className="italic text-cca-textSecondary/40">Système</span>}
                                    </span>
                                </div>
                            </Td>

                            {/* COFFRE */}
                            <Td>
                                {row.ownerRef?.name ? (
                                    <div className="flex flex-col group/owner relative">
                                        <span className="font-black text-cca-textPrimary px-2 py-1 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-xs shadow-sm">
                                            {row.ownerRef.name}
                                        </span>
                                        <span className="
                                            absolute -top-8 left-0 scale-0 group-hover/owner:scale-100 
                                            transition-all duration-200 bg-cca-surface border border-cca-border 
                                            px-2 py-1 rounded text-[9px] font-mono text-cca-textSecondary z-20 whitespace-nowrap
                                        ">
                                            Code: {row.owner}
                                        </span>
                                    </div>
                                ) : row.owner ? (
                                    <span className="font-medium text-cca-textSecondary px-2 py-1 rounded-lg bg-cca-base border border-cca-border/50 text-xs">
                                        {row.owner}
                                    </span>
                                ) : (
                                    <span className="text-cca-textSecondary/30 italic text-xs">—</span>
                                )}
                            </Td>

                            {/* DATE */}
                            <Td>
                                <div className="flex flex-col text-xs">
                                    <span className="font-bold text-cca-textPrimary">
                                        {row.occurredAt ? format(new Date(row.occurredAt), "d MMM yyyy", { locale: fr }) : "—"}
                                    </span>
                                    <span className="text-[10px] font-medium text-cca-textSecondary/50">
                                        à {row.occurredAt ? format(new Date(row.occurredAt), "HH:mm", { locale: fr }) : "—"}
                                    </span>
                                </div>
                            </Td>

                        </tr>
                    ))}
                </tbody>

            </table>
        </div>
    );
}


/* ------------------------
   Helper Components
------------------------ */

function getInitials(name) {
    if (!name) return "?";
    return name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function Th({ children }) {
    return (
        <th
            className="
                px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60
                border-b border-cca-border/30 text-left whitespace-nowrap
            "
        >
            {children}
        </th>
    );
}

function Td({ children }) {
    return (
        <td className="px-6 py-4 text-cca-textPrimary whitespace-nowrap border-b border-cca-border/10">
            {children}
        </td>
    );
}
