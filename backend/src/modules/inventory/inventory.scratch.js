// backend/src/modules/inventory/inventory.scratch.js

module.exports = {
  blocks: [
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
    // --- CAPTEURS ---
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
      "tooltip": "Vérifie le nom du produit.",
      "helpUrl": ""
    },
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
      "tooltip": "Vérifie la présence d'un item spécifique.",
      "helpUrl": ""
    },
    {
      "type": "value_inventory_item",
      "message0": "Nom de l'item de l'événement",
      "output": "String",
      "colour": "#EAB308",
      "tooltip": "Renvoie le libellé (ou code) de l'item concerné.",
      "helpUrl": ""
    },
    {
      "type": "value_inventory_quantity",
      "message0": "Quantité de l'événement",
      "output": "Number",
      "colour": "#EAB308",
      "tooltip": "Renvoie la quantité de l'item concerné.",
      "helpUrl": ""
    },
    {
      "type": "check_inventory_item_is",
      "message0": "L'item correspond à %1",
      "args0": [{ "type": "field_input", "name": "ITEM", "text": "nom ou code" }],
      "output": "Boolean",
      "colour": "#3B82F6",
      "tooltip": "Vrai si le code OU le libellé contient le texte (insensible à la casse).",
      "helpUrl": ""
    },
    {
      "type": "check_inventory_quantity",
      "message0": "La quantité est %1 %2",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "OPERATOR",
          "options": [[">", "GT"], ["<", "LT"], ["=", "EQ"], [">=", "GTE"], ["<=", "LTE"]]
        },
        { "type": "field_number", "name": "VALUE", "value": 0 }
      ],
      "output": "Boolean",
      "colour": "#3B82F6",
      "tooltip": "Compare la quantité de l'événement à une valeur.",
      "helpUrl": ""
    }
  ],
  toolbox: {
    "name": "Inventaire",
    "colour": "#EAB308",
    "blocks": [
      { "type": "event_inventory_exit" },
      { "type": "event_inventory_entry" },
      { "type": "value_inventory_item" },
      { "type": "value_inventory_quantity" },
      { "type": "check_inventory_item_is" },
      { "type": "check_inventory_quantity" },
      { "type": "check_product_name" },
      { "type": "check_item_list" }
    ]
  }
};
