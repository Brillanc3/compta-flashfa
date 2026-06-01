// /frontend/src/pages/dashboard/GaragePage.jsx

import React, { useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useGarage } from "@/hooks/useGarage";
import GarageFilters from "@/components/garage/GarageFilters";
import MovementTable from "@/components/garage/MovementTable";
import VehicleModal from "@/components/garage/VehicleModal";
import Spinner from "@/components/ui/Spinner";

export default function GaragePage() {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    // IMPORTANT : on laisse le hook se monter, mais l'UI ne doit pas afficher "vide"
    // tant que companyId n'est pas défini.
    const {
        filters,
        updateFilter,
        addTag,
        removeTag,
        resetAllFilters,
        query,
    } = useGarage(companyId);

    const movements = useMemo(() => {
        const data = query?.data;
        return Array.isArray(data) ? data : [];
    }, [query?.data]);

    // isLoading peut être false si la query est "idle/disabled"
    // isFetching couvre les refetch/refresh, et on ajoute !companyId pour éviter l'état "vide" au démarrage.
    const loading = !companyId || query?.isLoading || query?.isFetching;

    // Modal voiture
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);

    const openVehicleModal = (vehicle) => {
        // vehicle peut être:
        // - un number (vehicleId) -> création / enregistrement
        // - un objet { id, vehicleId, displayName, plate } -> édition
        if (typeof vehicle === "number") {
            setEditingVehicle({ vehicleId: vehicle });
        } else if (vehicle && typeof vehicle === "object") {
            if (vehicle.id) {
                setEditingVehicle({
                    id: vehicle.id,
                    vehicleId: vehicle.vehicleId,
                    displayName: vehicle.displayName,
                    plate: vehicle.plate,
                });
            } else if (vehicle.vehicleId) {
                setEditingVehicle({ vehicleId: vehicle.vehicleId });
            } else {
                setEditingVehicle(null);
            }
        } else {
            setEditingVehicle(null);
        }

        setModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-cca-textPrimary">Garage — Mouvements</h1>

            <GarageFilters
                filters={filters}
                updateFilter={updateFilter}
                addTag={addTag}
                removeTag={removeTag}
                resetAllFilters={resetAllFilters}
            />

            <div
                className="
                    relative overflow-hidden rounded-xl mt-2
                    bg-cca-surface border border-cca-border shadow-2xl shadow-black/40
                "
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Spinner />
                        {!companyId && (
                            <p className="text-cca-textSecondary text-sm">
                                Sélection d’une entreprise…
                            </p>
                        )}
                    </div>
                ) : (
                    <MovementTable
                        data={movements}
                        onOpenVehicleModal={openVehicleModal}
                    />
                )}
            </div>

            <VehicleModal
                isOpen={modalOpen}
                data={editingVehicle}
                onClose={() => setModalOpen(false)}
                onSaved={() => {
                    setModalOpen(false);
                    query?.refetch?.();
                }}
            />
        </div>
    );
}
