// backend/src/modules/automation/lib/automationEngine.js

const prisma = require('../../../db');
const interpreter = require('./interpreter');
const memoryStore = require('./memoryStore');
const effects = require('./effects');

// Mapping logType -> bloc trigger Scratch (compta). L'inventaire est géré à part (par catégorie).
const COMPTA_TRIGGER_MAP = {
    'create': 'event_compta_bill_created',
    'paid': 'event_compta_bill_paid',
    'paidCash': 'event_compta_bill_paid',
    'cancel': 'event_compta_bill_canceled',
    'addmoney': 'event_compta_money_received',
    'withdraw': 'event_compta_money_withdrawn',
    'EXPENSE_REPORT_CREATE': 'event_compta_expense_report_created',
    'EXPENSE_REPORT_STATUS_CHANGE': 'event_compta_expense_report_status_changed',
};

/** Normalise un identifiant de trigger : "event_inventory_entry" et "INVENTORY_ENTRY" -> "INVENTORY_ENTRY". */
function normalizeTrigger(t) {
    return String(t || '').replace(/^event_/, '').toUpperCase();
}

// Trigger planifié (cycle 60s). Doit correspondre au bloc `event_every_minute`
// (admin.scratch.js) : normalisé -> "EVERY_MINUTE", comme les workflows enregistrés.
const SCHEDULE_TRIGGER = 'event_every_minute';

/** Détermine le bloc trigger Scratch correspondant à un log. */
function mapLogToTrigger(log) {
    if (log.category === 'inventory') {
        if (log.logType === 'add') return 'event_inventory_entry';
        if (log.logType === 'remove') return 'event_inventory_exit';
        return null;
    }
    return COMPTA_TRIGGER_MAP[log.logType] || log.logType;
}

class AutomationEngine {
    constructor() {
        this.startScheduler();
    }

    startScheduler() {
        console.log('[AutomationEngine] 🕒 Scheduler démarré (cycle de 60s).');
        setInterval(async () => {
            try {
                const companies = await prisma.companyModule.findMany({
                    where: { module: { name: 'scratch' } },
                    select: { companyId: true },
                });
                for (const cm of companies) {
                    await this.triggerScheduled(cm.companyId, SCHEDULE_TRIGGER);
                }
            } catch (error) {
                console.error('[AutomationEngine] Erreur scheduler :', error);
            }
        }, 60000);
    }

    async triggerScheduled(companyId, triggerType) {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        const workflows = (settings?.settings?.automation_workflows || [])
            .filter((w) => w.active && normalizeTrigger(w.trigger) === normalizeTrigger(triggerType));
        for (const wf of workflows) {
            await this.execute(wf, { companyId, trigger: triggerType });
        }
    }

    /** Point d'entrée pour les logs système (appelé par logProcessor.service). */
    async trigger(log) {
        try {
            const scratchModule = await prisma.companyModule.findFirst({
                where: { companyId: log.companyId, module: { name: 'scratch' } },
            });
            if (!scratchModule) return;

            const triggerType = mapLogToTrigger(log);
            if (!triggerType) return;

            const settings = await prisma.companySettings.findUnique({ where: { companyId: log.companyId } });
            const workflows = (settings?.settings?.automation_workflows || [])
                .filter((w) => w.active && normalizeTrigger(w.trigger) === normalizeTrigger(triggerType));

            for (const wf of workflows) {
                await this.execute(wf, { ...log, trigger: triggerType });
            }
        } catch (error) {
            console.error('[AutomationEngine] Erreur trigger :', error);
        }
    }

    async execute(workflow, context) {
        if (!workflow.json || !workflow.json.blocks) {
            console.warn(`[AutomationEngine] Workflow "${workflow.name}" sans JSON valide.`);
            return;
        }
        const topBlocks = workflow.json.blocks.blocks || [];
        const startBlock = topBlocks.find((b) => normalizeTrigger(b.type) === normalizeTrigger(workflow.trigger));
        const firstBlock = startBlock?.next?.block;
        if (!firstBlock) return;

        const companyId = context.companyId;
        const workflowId = workflow.id || workflow.name || 'main';

        await memoryStore.withCompanyLock(companyId, async () => {
            const memory = await memoryStore.load(companyId, workflowId);
            const env = interpreter.makeEnv({
                context,
                memory,
                effects,
                log: (m) => console.log(`[AutomationEngine] ${m}`),
            });
            try {
                console.log(`[AutomationEngine] ⚙️ Exécution "${workflow.name}" (Company ${companyId})`);
                await interpreter.runWorkflow(firstBlock, env);
            } finally {
                if (memory.dirty) await memoryStore.save(companyId, workflowId, memory);
            }
        });
    }
}

const instance = new AutomationEngine();
// Expose l'instance (singleton) ET les helpers purs (tests / réutilisation).
instance.normalizeTrigger = normalizeTrigger;
instance.mapLogToTrigger = mapLogToTrigger;
instance.SCHEDULE_TRIGGER = SCHEDULE_TRIGGER;

module.exports = instance;
