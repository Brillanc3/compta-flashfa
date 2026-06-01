// /backend/src/modules/mecano/mecano.routes.js

async function mecanoRoutes(_fastify, _opts) {
    // Aucun endpoint pour le moment
}

module.exports = {
    name: "mecano",
    routes: mecanoRoutes,

    payments: [
        {
            key: "customVehicleRemuneration",
            label: "Rémunération Custom véhicule",
            type: "matrix",
            description:
                'Détecte les factures payées dont la raison contient "Custom véhicule". Base par facture = min(montant/2, limite).',
            source: {
                type: "data",
                data: [{ id: "customVehicle", name: "Custom de véhicule" }],
                labelField: "name",
                valueField: "id",
            },
            columns: [
                {
                    key: "limit",
                    label: "Limite ($)",
                    type: "number",
                    min: 0,
                    max: 10000,
                    step: 1,
                    default: 10000,
                },
                {
                    key: "commission",
                    label: "Commission (%)",
                    type: "number",
                    min: 0,
                    max: 100,
                    step: 0.01,
                    default: 0,
                },
                {
                    key: "fixed",
                    label: "Fix ($)",
                    type: "number",
                    min: 0,
                    max: 20000,
                    step: 1,
                    default: 0,
                },
            ],
        },
    ],

    salaryCalculators: [
        {
            key: "customVehicleRemuneration",
            serviceFunction: "calculateCustomVehicleSalary",
            drawingDetails: {
                label: "Custom de véhicule",
                template:
                    "Commission: {customBaseTotal} $ * {customCommission} % = {commissionValue} $ | Fix: {customCount} * {customFixed} $ = {fixedValue} $ | Total = {calculatedValue} $",
            },
        },
    ],
};
