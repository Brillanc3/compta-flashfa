// /frontend/src/components/garage/MovementTable.jsx

import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* -----------------------------------------
   Mini Avatar
------------------------------------------*/
const Avatar = ({ user }) => {
    if (!user) {
        return (
            <div className="h-8 w-8 rounded-full bg-cca-base border border-cca-border flex items-center justify-center text-cca-textSecondary text-xs">
                ?
            </div>
        );
    }

    if (user.imageUrl) {
        return (
            <img
                src={user.imageUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover border border-cca-border"
            />
        );
    }

    const initials = user.name
        ? user.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "?";

    return (
        <div className="h-8 w-8 rounded-full bg-cca-base border border-cca-border flex items-center justify-center text-cca-textPrimary text-xs font-semibold">
            {initials}
        </div>
    );
};

/* -----------------------------------------
   Badge type mouvement
------------------------------------------*/
const TypeBadge = ({ type }) => {
    if (type === "OUT")
        return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                Sortie
            </span>
        );

    return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            Rangement
        </span>
    );
};

/* -----------------------------------------
   TABLE PRINCIPALE
------------------------------------------*/
function MovementTable({ data, onOpenVehicleModal, onCreateVehicle }) {
    if (!data || data.length === 0) {
        return (
            <p className="text-center text-cca-textSecondary py-6">Aucun mouvement trouvé.</p>
        );
    }

    const handleOpen = (vehicle) => {
        // Nouveau prop: onOpenVehicleModal(vehicle | vehicleId)
        if (typeof onOpenVehicleModal === "function") {
            onOpenVehicleModal(vehicle);
            return;
        }

        // Backward compat: ancien prop onCreateVehicle(vehicleId)
        if (typeof onCreateVehicle === "function") {
            onCreateVehicle(vehicle);
        }
    };

    return (
        <>
            {/* Mobile: cards */}
            <div className="md:hidden p-3 space-y-3">
                {data.map((mvt) => {
                    const registered = mvt.vehicleRef;
                    const userName = mvt.user?.name || mvt.properName || "Inconnu";
                    const occurredAt = format(new Date(mvt.occurredAt), "d MMM yyyy HH:mm", {
                        locale: fr,
                    });

                    const canEdit = !!registered?.id;
                    const openPayload = canEdit
                        ? {
                            id: registered.id,
                            vehicleId: mvt.vehicleId,
                            displayName: registered.displayName,
                            plate: registered.plate,
                        }
                        : mvt.vehicleId;

                    return (
                        <div
                            key={mvt.id}
                            className="
                                relative rounded-2xl border border-cca-border bg-cca-surface/30 backdrop-blur-xl p-5 
                                transition-all hover:bg-cca-surface shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300
                            "
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs text-cca-textSecondary">{occurredAt}</div>
                                    <div className="mt-1">
                                        <TypeBadge type={mvt.type} />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpen(openPayload)}
                                    className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white"
                                >
                                    {canEdit ? "Modifier" : "Enregistrer"}
                                </button>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Véhicule</div>
                                        <div className="text-sm text-cca-textPrimary font-bold">
                                            {registered?.displayName || `#${mvt.vehicleId}`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Plaque</div>
                                        <div className="text-sm text-cca-textPrimary">
                                            {registered?.plate ? (
                                                registered.plate
                                            ) : (
                                                <span className="text-cca-textSecondary/40 italic">Indéfini</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Effectué par</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <Avatar user={mvt.user} />
                                            <span className="text-sm text-cca-textPrimary font-semibold">{userName}</span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-[11px] uppercase tracking-wide text-cca-textSecondary">Marker</div>
                                        <div className="text-sm text-cca-textPrimary font-bold">{mvt.markerId ?? "-"}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block relative overflow-hidden rounded-2xl border border-cca-border bg-cca-surface/30 backdrop-blur-2xl shadow-xl">
                <table className="min-w-full text-sm text-cca-textPrimary">
                    <thead className="sticky top-0 z-10 bg-cca-base backdrop-blur-md border-b border-cca-border">
                    <tr>
                        <Th>Date</Th>
                        <Th>Type</Th>
                        <Th>Véhicule</Th>
                        <Th>Plaque</Th>
                        <Th>Effectué par</Th>
                        <Th>Marker</Th>
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-cca-border/30">
                    {data.map((mvt) => {
                        const registered = mvt.vehicleRef; // si véhicule enregistré
                        const canEdit = !!registered?.id;
                        const openPayload = canEdit
                            ? {
                                id: registered.id,
                                vehicleId: mvt.vehicleId,
                                displayName: registered.displayName,
                                plate: registered.plate,
                            }
                            : mvt.vehicleId;

                        return (
                            <tr
                                key={mvt.id}
                                className="group transition-all hover:bg-cca-surface/40"
                            >
                                {/* DATE */}
                                <Td>
                                    {format(new Date(mvt.occurredAt), "d MMM yyyy HH:mm", {
                                        locale: fr,
                                    })}
                                </Td>

                                {/* TYPE */}
                                <Td>
                                    <TypeBadge type={mvt.type} />
                                </Td>

                                {/* VEHICLE */}
                                <Td>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpen(openPayload)}
                                            className="text-brand-primary hover:text-brand-light font-semibold transition-colors underline decoration-brand-primary/20 underline-offset-4"
                                        >
                                            {registered?.displayName
                                                ? registered.displayName
                                                : `#${mvt.vehicleId}`}
                                            <span className="text-[10px] opacity-60 ml-1">
                                                ({canEdit ? "Modifier" : "Enregistrer"})
                                            </span>
                                        </button>
                                    </div>
                                </Td>

                                {/* PLAQUE */}
                                <Td>
                                    {registered?.plate ? (
                                        registered.plate
                                    ) : (
                                        <span className="text-cca-textSecondary/40 italic">Indéfini</span>
                                    )}
                                </Td>

                                {/* USER */}
                                <Td>
                                    <div className="flex items-center gap-2">
                                        <Avatar user={mvt.user} />
                                        <span>{mvt.user?.name || mvt.properName || "Inconnu"}</span>
                                    </div>
                                </Td>

                                {/* MARKER */}
                                <Td>{mvt.markerId ?? "-"}</Td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </>
    );
}

/* -----------------------------------------
   Helpers table
------------------------------------------*/
function Th({ children }) {
    return (
        <th className="
            px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] 
            text-cca-textSecondary/60 border-r border-cca-border/20 last:border-r-0
        ">
            {children}
        </th>
    );
}

function Td({ children }) {
    return (
        <td className="px-6 py-4 whitespace-nowrap text-cca-textSecondary font-medium">
            {children}
        </td>
    );
}

export default MovementTable;
