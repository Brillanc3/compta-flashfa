// backend/src/modules/inventory/inventory.templates.js
//
// Modèles de workflows prêts à l'emploi déclenchés par l'inventaire.
// Variables disponibles dans les messages : {item} {quantity} {owner} {memory.X}.
'use strict';

const b = require('../automation/lib/blockBuilders');

module.exports = [
    {
        id: 'inv_big_exit_alert',
        name: 'Alerte grosse sortie',
        description: "Quand une grosse quantité d'un produit sort de l'inventaire, envoie une alerte dans le tchat.",
        category: 'Inventaire',
        color: '#EAB308',
        trigger: 'event_inventory_exit',
        state: b.workflow(
            'event_inventory_exit',
            b.ifSimple(
                b.checkQty('GTE', 10),
                b.tchat('⚠️ Sortie importante : {quantity}x {item} retirés par {owner}'),
            ),
        ),
    },
    {
        id: 'inv_entry_log',
        name: 'Journal des entrées',
        description: "À chaque produit déposé dans l'inventaire, publie une ligne de journal dans le tchat.",
        category: 'Inventaire',
        color: '#EAB308',
        trigger: 'event_inventory_entry',
        state: b.workflow(
            'event_inventory_entry',
            b.tchat('📦 Entrée : {quantity}x {item} déposés par {owner}'),
        ),
    },
    {
        id: 'inv_item_filter_example',
        name: 'Suivi d\'un produit précis (ex. boeuf)',
        description: "Exemple pré-rempli avec un produit réel de votre inventaire : alerte le tchat dès que ce produit sort. Changez le nom du produit selon vos besoins.",
        category: 'Inventaire',
        color: '#EAB308',
        trigger: 'event_inventory_exit',
        state: b.workflow(
            'event_inventory_exit',
            b.ifSimple(
                b.checkItemIs('boeuf'),
                b.tchat('🥩 Sortie de boeuf : {quantity} unité(s) par {owner}'),
            ),
        ),
    },
    {
        id: 'inv_item_qty_combo',
        name: 'Grosse sortie d\'un produit précis (ex. boeuf > 15)',
        description: "Conditions imbriquées : quand un produit sort, si c'est le produit visé (boeuf) ET que la quantité dépasse 15, alerte le tchat.",
        category: 'Inventaire',
        color: '#EAB308',
        trigger: 'event_inventory_exit',
        state: b.workflow(
            'event_inventory_exit',
            b.ifSimple(
                b.checkItemIs('boeuf'),
                b.ifSimple(
                    b.checkQty('GT', 15),
                    b.tchat('🥩 Grosse sortie de boeuf : {quantity} unités retirées par {owner}'),
                ),
            ),
        ),
    },
    {
        id: 'inv_cumulative_threshold',
        name: 'Compteur de sorties + seuil',
        description: "Cumule les quantités sorties en mémoire et alerte le tchat dès que le seuil (50) est franchi, puis réinitialise le compteur.",
        category: 'Inventaire',
        color: '#EAB308',
        trigger: 'event_inventory_exit',
        state: b.workflow(
            'event_inventory_exit',
            b.chain(
                b.memAdd('sorties_cumulees', b.valQty()),
                b.ifSimple(
                    b.cmp('GTE', b.memGet('sorties_cumulees'), b.num(50)),
                    b.chain(
                        b.tchat('🚨 Seuil atteint : {memory.sorties_cumulees} unités sorties au total.'),
                        b.memReset(),
                    ),
                ),
            ),
        ),
    },
    {
        id: 'inv_big_exit_notify',
        name: 'Alerte grosse sortie (notification)',
        description: "Variante notification interne : prévient tous les employés lors d'une grosse sortie de stock.",
        category: 'Notifications',
        color: '#22C55E',
        trigger: 'event_inventory_exit',
        state: b.workflow(
            'event_inventory_exit',
            b.ifSimple(
                b.checkQty('GTE', 10),
                b.notify('Sortie de stock importante', '{quantity}x {item} retirés par {owner}'),
            ),
        ),
    },
];
