import * as Blockly from 'blockly';

export const defineAutomationBlocks = () => {
  Blockly.defineBlocksWithJsonArray([
    // --- ÉVÉNEMENTS (TRIGGERS) ---
    {
      "type": "event_inventory_exit",
      "message0": "Quand un produit sort de l'inventaire",
      "nextStatement": null,
      "colour": "#EAB308",
      "tooltip": "Se déclenche lorsqu'un objet est retiré de l'inventaire.",
      "helpUrl": ""
    },
    {
      "type": "event_inventory_entry",
      "message0": "Quand un produit rentre dans l'inventaire",
      "nextStatement": null,
      "colour": "#EAB308",
      "tooltip": "Se déclenche lorsqu'un objet est ajouté à l'inventaire.",
      "helpUrl": ""
    },

    // --- CAPTEURS (SENSORS / CONDITIONS) ---
    {
      "type": "check_product_name",
      "message0": "Le produit est %1",
      "args0": [
        {
          "type": "field_input",
          "name": "PRODUCT",
          "text": "Nom du produit"
        }
      ],
      "output": "Boolean",
      "colour": "#3B82F6",
      "tooltip": "Vérifie le nom du produit impliqué dans l'événement.",
      "helpUrl": ""
    },
    {
      "type": "check_quantity",
      "message0": "La quantité est %1 %2",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "OP",
          "options": [
            ["=", "EQ"],
            [">", "GT"],
            ["<", "LT"],
            [">=", "GTE"],
            ["<=", "LTE"]
          ]
        },
        {
          "type": "field_number",
          "name": "VALUE",
          "value": 1
        }
      ],
      "output": "Boolean",
      "colour": "#3B82F6",
      "tooltip": "Vérifie la quantité du produit.",
      "helpUrl": ""
    },

    // --- CONTRÔLE (CONTROL) ---
    {
      "type": "control_wait",
      "message0": "Attendre %1 minutes",
      "args0": [
        {
          "type": "field_number",
          "name": "MINUTES",
          "value": 15,
          "min": 0
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Suspend l'exécution pendant un certain temps.",
      "helpUrl": ""
    },
    {
      "type": "controls_if_simple",
      "message0": "Si %1 alors",
      "args0": [
        {
          "type": "input_value",
          "name": "IF0",
          "check": "Boolean"
        }
      ],
      "message1": "faire %1",
      "args1": [
        {
          "type": "input_statement",
          "name": "DO0"
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Exécute les blocs si la condition est vraie.",
      "helpUrl": ""
    },

    // --- ATTENTE D'ÉVÉNEMENT FILTRÉE (WAIT FOR EVENT FILTERED) ---
    {
      "type": "control_wait_for_event_filtered",
      "message0": "Attendre l'événement %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "EVENT",
          "options": [
            ["Entrée d'inventaire", "INVENTORY_ENTRY"]
          ]
        }
      ],
      "message1": "qui respecte la condition : %1",
      "args1": [
        {
          "type": "input_value",
          "name": "CONDITION",
          "check": "Boolean"
        }
      ],
      "message2": "Pendant maximum %1 minutes",
      "args2": [
        {
          "type": "field_number",
          "name": "TIMEOUT",
          "value": 15
        }
      ],
      "message3": "Si trouvé : %1",
      "args3": [
        {
          "type": "input_statement",
          "name": "ON_EVENT"
        }
      ],
      "message4": "Si expiration : %1",
      "args4": [
        {
          "type": "input_statement",
          "name": "ON_TIMEOUT"
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#A855F7",
      "tooltip": "Attend un événement spécifique. Ignore les événements qui ne respectent pas la condition.",
      "helpUrl": ""
    },

    // --- MÉMOIRE / VARIABLES (MEMORY) ---
    {
      "type": "memory_set",
      "message0": "Mettre dans la mémoire %1 la valeur %2",
      "args0": [
        {
          "type": "field_input",
          "name": "VAR",
          "text": "nom_variable"
        },
        {
          "type": "input_value",
          "name": "VALUE",
          "check": "Number"
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#3b82f6",
      "tooltip": "Enregistre une valeur dans la mémoire globale de l'automate.",
      "helpUrl": ""
    },
    {
      "type": "memory_add",
      "message0": "Ajouter %1 à la mémoire %2",
      "args0": [
        {
          "type": "input_value",
          "name": "VALUE",
          "check": "Number"
        },
        {
          "type": "field_input",
          "name": "VAR",
          "text": "nom_variable"
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#3b82f6",
      "tooltip": "Ajoute une valeur à une variable en mémoire (utile pour compter).",
      "helpUrl": ""
    },
    {
      "type": "memory_get",
      "message0": "Valeur de %1",
      "args0": [
        {
          "type": "field_input",
          "name": "VAR",
          "text": "nom_variable"
        }
      ],
      "output": "Number",
      "colour": "#3b82f6",
      "tooltip": "Récupère la valeur stockée en mémoire sous ce nom.",
      "helpUrl": ""
    },
    {
      "type": "memory_reset_all",
      "message0": "Vider toute la mémoire",
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#EF4444",
      "tooltip": "Efface toutes les variables stockées dans l'automate.",
      "helpUrl": ""
    },

    // --- CAPTEURS AVANCÉS ---
    {
      "type": "check_item_list",
      "message0": "L'événement contient l'item %1 en quantité %2",
      "args0": [
        {
          "type": "field_input",
          "name": "PRODUCT",
          "text": "Nom"
        },
        {
          "type": "field_number",
          "name": "QTY",
          "value": 1
        }
      ],
      "output": "Boolean",
      "colour": "#3B82F6",
      "tooltip": "Vérifie la présence d'un item spécifique dans la liste des objets transférés.",
      "helpUrl": ""
    },

    // --- ACTIONS DÉTAILLÉES ---
    {
      "type": "action_notify_detailed",
      "message0": "Envoyer notification à %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET_TYPE",
          "options": [
            ["Tout le monde", "ALL"],
            ["Un Rang spécifique", "RANK"],
            ["Un Utilisateur", "USER"]
          ]
        }
      ],
      "message1": "Cible ID : %1",
      "args1": [
        {
          "type": "field_input",
          "name": "TARGET_ID",
          "text": "ID ou Nom"
        }
      ],
      "message2": "Titre : %1",
      "args2": [
        {
          "type": "field_input",
          "name": "TITLE",
          "text": "Alerte Inventaire"
        }
      ],
      "message3": "Message : %1",
      "args3": [
        {
          "type": "field_input",
          "name": "BODY",
          "text": "Le produit n'est pas revenu..."
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#22C55E",
      "tooltip": "Envoie une notification détaillée à une cible spécifique.",
      "helpUrl": ""
    },
    {
      "type": "action_log",
      "message0": "Loguer l'événement : %1",
      "args0": [
        {
          "type": "field_input",
          "name": "LOG",
          "text": "Détails"
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#22C55E",
      "tooltip": "Ajoute une entrée dans les logs.",
      "helpUrl": ""
    }
  ]);
};
