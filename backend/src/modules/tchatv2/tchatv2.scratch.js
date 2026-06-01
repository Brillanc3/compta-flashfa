// backend/src/modules/tchatv2/tchatv2.scratch.js

module.exports = {
  blocks: [
    {
      "type": "action_tchat_send_message",
      "message0": "Envoyer dans le salon %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "CHANNEL",
          // Placeholder remplacé dynamiquement par getConfig (salons réels de la company).
          // field_dropdown exige au moins une option à la définition.
          "options": [["(sélectionner un salon)", "0"]]
        }
      ],
      "message1": "le message %1",
      "args1": [
        { "type": "field_input", "name": "MESSAGE", "text": "Message... {item} {quantity}" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#5865F2",
      "tooltip": "Envoie un message automatique dans un salon du tchat de l'entreprise. Variables : {item} {quantity} {owner} {amount} {reason} {memory.X}.",
      "helpUrl": ""
    }
  ],
  toolbox: {
    "name": "Tchat",
    "colour": "#5865F2",
    "blocks": [
      { "type": "action_tchat_send_message" }
    ]
  }
};
