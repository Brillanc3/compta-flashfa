// backend/src/modules/comptabilite/comptabilite.templates.js
//
// Modèles de workflows prêts à l'emploi déclenchés par la comptabilité.
// Variables disponibles dans les messages : {amount} {reason} {memory.X}.
'use strict';

const b = require('../automation/lib/blockBuilders');

module.exports = [
    {
        id: 'compta_big_expense',
        name: 'Alerte grosse facture',
        description: "Quand une facture dépassant 5000$ est créée, envoie une alerte dans le tchat.",
        category: 'Comptabilité',
        color: '#10B981',
        trigger: 'event_compta_bill_created',
        state: b.workflow(
            'event_compta_bill_created',
            // check_compta_amount est une garde : si faux, la chaîne s'arrête.
            b.chain(
                b.checkAmount('GT', 5000),
                b.tchat('💸 Grosse facture créée : ${amount} — {reason}'),
            ),
        ),
    },
    {
        id: 'compta_deposit_received',
        name: 'Dépôt reçu',
        description: "À chaque dépôt d'argent sur le compte entreprise, publie un message dans le tchat.",
        category: 'Comptabilité',
        color: '#10B981',
        trigger: 'event_compta_money_received',
        state: b.workflow(
            'event_compta_money_received',
            b.tchat('💰 Dépôt reçu : ${amount}'),
        ),
    },
    {
        id: 'compta_bill_canceled',
        name: 'Facture annulée',
        description: "Prévient le tchat dès qu'une facture est annulée.",
        category: 'Comptabilité',
        color: '#10B981',
        trigger: 'event_compta_bill_canceled',
        state: b.workflow(
            'event_compta_bill_canceled',
            b.tchat('❌ Facture annulée : ${amount} — {reason}'),
        ),
    },
    {
        id: 'compta_auto_approve_expense',
        name: 'Note de frais auto-approuvée',
        description: "Approuve automatiquement les notes de frais de 100$ ou moins, puis confirme dans le tchat.",
        category: 'Comptabilité',
        color: '#8B5CF6',
        trigger: 'event_compta_expense_report_created',
        state: b.workflow(
            'event_compta_expense_report_created',
            b.chain(
                b.checkAmount('LTE', 100),
                b.setExpense('REIMBURSED'),
                b.tchat('✅ Note de frais auto-approuvée (${amount}).'),
            ),
        ),
    },
    {
        id: 'compta_big_expense_notify',
        name: 'Alerte grosse facture (notification)',
        description: "Variante notification interne : prévient tous les employés lors d'une grosse facture.",
        category: 'Notifications',
        color: '#22C55E',
        trigger: 'event_compta_bill_created',
        state: b.workflow(
            'event_compta_bill_created',
            b.chain(
                b.checkAmount('GT', 5000),
                b.notify('Grosse dépense', '${amount} — {reason}'),
            ),
        ),
    },
];
