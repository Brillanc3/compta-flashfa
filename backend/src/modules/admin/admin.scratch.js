// backend/src/modules/admin/admin.scratch.js

module.exports = {
  blocks: [
    {
      "type": "event_every_minute",
      "message0": "Chaque minute",
      "nextStatement": null,
      "colour": "#EF4444",
      "tooltip": "Se déclenche toutes les minutes pour des tests.",
      "helpUrl": ""
    }
  ],
  toolbox: {
    "name": "Administration",
    "colour": "#EF4444",
    "blocks": [
      { "type": "event_every_minute" }
    ]
  }
};
