// /frontend/src/components/garage/VehicleModal.jsx

import React, { useEffect, useState } from "react";
import {
    createVehicle,
    updateVehicle
} from "@/services/garageService";
import { useCompany } from "@/contexts/CompanyContext";
import toast from "react-hot-toast";

export default function VehicleModal({ isOpen, onClose, data, onSaved }) {
    const { selectedCompany } = useCompany();
    const _companyId = selectedCompany?.id;

    const editing = data?.id ? true : false;

    const [vehicleId, setVehicleId] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [plate, setPlate] = useState("");

    /* ----------------------------------------------------------------------
       Préremplissage si modal ouverte pour un véhicule existant ou un ID
    -----------------------------------------------------------------------*/
    useEffect(() => {
        if (!isOpen) return;

        if (editing) {
            setVehicleId(data.vehicleId ?? "");
            setDisplayName(data.displayName ?? "");
            setPlate(data.plate ?? "");
        } else {
            // Ouverture pour créer à partir d’un mouvement
            setVehicleId(data?.vehicleId ?? "");
            setDisplayName("");
            setPlate("");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, isOpen]);

    if (!isOpen) return null;

    /* ----------------------------------------------------------------------
       Enregistrement du véhicule
    -----------------------------------------------------------------------*/
    const handleSubmit = async () => {
        if (!vehicleId) {
            toast.error("Le vehicleId est obligatoire.");
            return;
        }

        const payload = {
            vehicleId: Number(vehicleId),
            displayName: displayName.trim() || null,
            plate: plate.trim() || null,
        };

        try {
            if (editing) {
                await updateVehicle(data.id, payload);
                toast.success("Véhicule mis à jour !");
            } else {
                await createVehicle(payload);
                toast.success("Véhicule enregistré !");
            }

            onSaved?.();
            onClose();
        } catch (err) {
            toast.error(err?.message || "Erreur lors de l’enregistrement.");
        }
    };

    /* ----------------------------------------------------------------------
       UI Modal Premium Glass
    -----------------------------------------------------------------------*/
    return (
        <div className="
            fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50
        ">
            <div className="
                w-full max-w-md rounded-2xl p-6 relative
                bg-cca-surface border border-cca-border shadow-2xl shadow-black/60
            ">
                {/* Title */}
                <h2 className="text-xl font-bold text-cca-textPrimary mb-6 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    {editing ? "Modifier le véhicule" : "Enregistrer un véhicule"}
                </h2>

                <div className="space-y-4">
                    {/* Vehicle ID */}
                    <div>
                        <label className="text-xs font-bold text-cca-textSecondary uppercase tracking-widest pl-1">Vehicle ID (FiveM)</label>
                        <input
                            type="number"
                            value={vehicleId}
                            onChange={(e) => setVehicleId(e.target.value)}
                            className="
                                w-full mt-1.5 rounded-xl bg-cca-base border border-cca-border
                                px-4 py-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition
                            "
                            disabled={editing}
                        />
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="text-xs font-bold text-cca-textSecondary uppercase tracking-widest pl-1">Nom affiché</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Ex : Audi RS6"
                            className="
                                w-full mt-1.5 rounded-xl bg-cca-base border border-cca-border
                                px-4 py-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition
                            "
                        />
                    </div>

                    {/* Plate */}
                    <div>
                        <label className="text-xs font-bold text-cca-textSecondary uppercase tracking-widest pl-1">Plaque</label>
                        <input
                            type="text"
                            value={plate}
                            onChange={(e) => setPlate(e.target.value)}
                            placeholder="Ex : AB-123-CD"
                            className="
                                w-full mt-1.5 rounded-xl bg-cca-base border border-cca-border
                                px-4 py-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition
                            "
                        />
                    </div>

                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="
                            px-6 py-2.5 rounded-xl bg-cca-base hover:bg-cca-border text-cca-textPrimary font-bold border border-cca-border
                            active:scale-95 transition
                        "
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="
                            px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold
                            active:scale-95 transition shadow-lg shadow-indigo-500/20
                        "
                    >
                        {editing ? "Modifier" : "Enregistrer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
