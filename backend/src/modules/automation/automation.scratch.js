// backend/src/modules/automation/automation.scratch.js

module.exports = {
  blocks: [
    // --- CONTRÔLE ---
    {
      "type": "control_wait",
      "message0": "Attendre %1 minutes",
      "args0": [
        {
          "type": "field_number",
          "name": "MINUTES",
          "value": 15
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Suspend l'exécution pdt un certain temps.",
      "helpUrl": ""
    },
    {
      "type": "controls_if_simple",
      "message0": "Si %1 alors",
      "args0": [{ "type": "input_value", "name": "IF0", "check": "Boolean" }],
      "message1": "faire %1",
      "args1": [{ "type": "input_statement", "name": "DO0" }],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Execute les blocs si vrai.",
      "helpUrl": ""
    },
    {
      "type": "control_if_else",
      "message0": "Si %1",
      "args0": [{ "type": "input_value", "name": "IF0", "check": "Boolean" }],
      "message1": "faire %1",
      "args1": [{ "type": "input_statement", "name": "DO0" }],
      "message2": "sinon %1",
      "args2": [{ "type": "input_statement", "name": "ELSE" }],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Exécute DO si vrai, sinon ELSE.",
      "helpUrl": ""
    },
    {
      "type": "control_repeat",
      "message0": "Répéter %1 fois",
      "args0": [{ "type": "field_number", "name": "TIMES", "value": 3, "min": 0 }],
      "message1": "faire %1",
      "args1": [{ "type": "input_statement", "name": "DO" }],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Répète les blocs un nombre fixe de fois.",
      "helpUrl": ""
    },
    {
      "type": "control_while",
      "message0": "Tant que %1",
      "args0": [{ "type": "input_value", "name": "COND", "check": "Boolean" }],
      "message1": "faire %1",
      "args1": [{ "type": "input_statement", "name": "DO" }],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Répète tant que la condition est vraie (plafond de sécurité 10000).",
      "helpUrl": ""
    },
    {
      "type": "control_wait_for_event_filtered",
      "message0": "Attendre l'événement %1 que %2 pendant %3 min",
      "args0": [
        { "type": "field_dropdown", "name": "EVENT", "options": [["Entrée d'inventaire", "INVENTORY_ENTRY"]] },
        { "type": "input_value", "name": "CONDITION", "check": "Boolean" },
        { "type": "field_number", "name": "TIMEOUT", "value": 15 }
      ],
      "message1": "Si trouvé : %1",
      "args1": [{ "type": "input_statement", "name": "ON_EVENT" }],
      "message2": "Si expiration : %1",
      "args2": [{ "type": "input_statement", "name": "ON_TIMEOUT" }],
      "previousStatement": null, "nextStatement": null, "colour": "#A855F7", "tooltip": "Filtre l'événement voulu."
    },
    // --- MÉMOIRE ---
    {
      "type": "memory_set",
      "message0": "Mettre mémoire %1 = %2",
      "args0": [{ "type": "field_input", "name": "VAR", "text": "nom" }, { "type": "input_value", "name": "VALUE" }],
      "previousStatement": null, "nextStatement": null, "colour": "#3b82f6"
    },
    {
      "type": "memory_add",
      "message0": "Ajouter %1 à mémoire %2",
      "args0": [{ "type": "input_value", "name": "VALUE" }, { "type": "field_input", "name": "VAR", "text": "nom" }],
      "previousStatement": null, "nextStatement": null, "colour": "#3b82f6"
    },
    {
      "type": "memory_get",
      "message0": "Valeur de %1",
      "args0": [{ "type": "field_input", "name": "VAR", "text": "nom" }],
      "output": null, "colour": "#3b82f6"
    },
    { "type": "memory_reset_all", "message0": "Vider toute la mémoire", "previousStatement": null, "nextStatement": null, "colour": "#EF4444" },
    // --- ACTIONS ---
    {
        "type": "action_notify_detailed",
        "message0": "Notifier %1",
        "args0": [{ "type": "field_dropdown", "name": "TARGET_TYPE", "options": [["Tous", "ALL"], ["Rang", "RANK"], ["User", "USER"]] }],
        "message1": "ID: %1 Titre: %2 Corps: %3",
        "args1": [{ "type": "field_input", "name": "TARGET_ID", "text": "ID" }, { "type": "field_input", "name": "TITLE", "text": "Titre" }, { "type": "field_input", "name": "BODY", "text": "Message" }],
        "previousStatement": null, "nextStatement": null, "colour": "#22C55E"
    }
  ],
  toolbox: [
    {
        "name": "Contrôle",
        "colour": "#A855F7",
        "blocks": [{ "type": "control_wait" }, { "type": "controls_if_simple" }, { "type": "control_if_else" }, { "type": "control_repeat" }, { "type": "control_while" }, { "type": "control_wait_for_event_filtered" }]
    },
    {
        "name": "Mémoire",
        "colour": "#3b82f6",
        "blocks": [{ "type": "memory_set" }, { "type": "memory_add" }, { "type": "memory_get" }, { "type": "memory_reset_all" }]
    },
    {
        "name": "Actions",
        "colour": "#22C55E",
        "blocks": [{ "type": "action_notify_detailed" }]
    }
  ]
};
