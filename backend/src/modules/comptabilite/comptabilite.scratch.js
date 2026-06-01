// backend/src/modules/comptabilite/comptabilite.scratch.js

module.exports = {
  blocks: [
    // --- Événements Note de Frais ---
    {
      "type": "event_compta_expense_report_created",
      "message0": "Quand une note de frais est créée",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché à la soumission d'une nouvelle note de frais.",
      "helpUrl": ""
    },
    {
      "type": "event_compta_expense_report_status_changed",
      "message0": "Quand une note de frais devient %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "STATUS",
          "options": [
            ["Approuvée", "REIMBURSED"],
            ["Refusée", "REJECTED"],
            ["En attente", "PENDING"]
          ]
        }
      ],
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché au changement de statut d'une note de frais.",
      "helpUrl": ""
    },

    // --- Événements Factures (Logs system) ---
    {
      "type": "event_compta_bill_created",
      "message0": "Quand une facture est créée",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché par le système lors de la création d'une facture.",
      "helpUrl": ""
    },
    {
      "type": "event_compta_bill_paid",
      "message0": "Quand une facture est payée (Carte ou Cash)",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché dès qu'une facture passe en statut payé.",
      "helpUrl": ""
    },
    {
      "type": "event_compta_bill_canceled",
      "message0": "Quand une facture est annulée",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché lors de l'annulation d'une facture.",
      "helpUrl": ""
    },

    // --- Événements Banque ---
    {
      "type": "event_compta_money_received",
      "message0": "Quand de l'argent est reçu (Dépôt)",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché lors d'un ajout d'argent sur le compte entreprise.",
      "helpUrl": ""
    },
    {
      "type": "event_compta_money_withdrawn",
      "message0": "Quand de l'argent est retiré (Retrait)",
      "nextStatement": null,
      "colour": "#10B981",
      "tooltip": "Déclenché lors d'un retrait d'argent du compte entreprise.",
      "helpUrl": ""
    },

    // --- Capteurs / Logic ---
    {
      "type": "check_compta_amount",
      "message0": "Si le montant est %1 %2",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "OPERATOR",
          "options": [
            [">", "GT"],
            ["<", "LT"],
            ["=", "EQ"],
            [">=", "GTE"],
            ["<=", "LTE"]
          ]
        },
        {
          "type": "field_number",
          "name": "VALUE",
          "value": 0
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#3B82F6",
      "tooltip": "Vérifie le montant de l'objet actuel (facture, transaction, note de frais).",
      "helpUrl": ""
    },
    {
      "type": "check_compta_reason_contains",
      "message0": "Si la raison contient %1",
      "args0": [
        {
          "type": "field_input",
          "name": "TEXT",
          "text": "..."
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#3B82F6",
      "tooltip": "Vérifie si le libellé contient un mot clé.",
      "helpUrl": ""
    },

    // --- Actions ---
    {
      "type": "action_compta_set_expense_status",
      "message0": "Changer le statut de la note de frais en %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "STATUS",
          "options": [
            ["Approuvée (Remboursée)", "REIMBURSED"],
            ["Refusée", "REJECTED"]
          ]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#8B5CF6",
      "tooltip": "Approuve ou refuse la note de frais activée.",
      "helpUrl": ""
    }
  ],
  toolbox: {
    "name": "Comptabilité",
    "colour": "#10B981",
    "blocks": [
      { "type": "event_compta_expense_report_created" },
      { "type": "event_compta_expense_report_status_changed" },
      { "type": "event_compta_bill_created" },
      { "type": "event_compta_bill_paid" },
      { "type": "event_compta_bill_canceled" },
      { "type": "event_compta_money_received" },
      { "type": "event_compta_money_withdrawn" },
      { "type": "check_compta_amount" },
      { "type": "check_compta_reason_contains" },
      { "type": "action_compta_set_expense_status" }
    ]
  }
};
