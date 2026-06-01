// backend/src/modules/automation/automation.controller.js

const prisma = require('../../db');
const registry = require('./automationRegistry');
const { getCompanyTextChannels } = require('../tchatv2/lib/companyChannels');

async function getConfig(request, reply) {
  const companyId = parseInt(request.headers['x-company-id'], 10);
  
  if (!companyId) {
    return reply.status(400).send({ error: "Company ID missing" });
  }

  // Vérifier si le module 'scratch' est activé pour cette entreprise
  const scratchModule = await prisma.companyModule.findFirst({
    where: {
      companyId: companyId,
      module: { name: 'scratch' }
    }
  });

  if (!scratchModule) {
    return reply.status(403).send({ 
      error: "Module 'scratch' non activé pour cette entreprise.",
      code: "SCRATCH_MODULE_REQUIRED"
    });
  }

  // Scanner les modules au besoin (ou utiliser le cache du registry)
  // Pour le dev, on scanne à chaque requête si on veut du HMR,
  // en prod on pourrait le faire une fois au boot.
  await registry.scan();

  // Clone profond : registry.getConfig() renvoie des objets partagés (require cache).
  // On ne doit pas muter ces objets (fuite inter-company).
  const config = JSON.parse(JSON.stringify(registry.getConfig()));

  // Injecte les salons réels de la company dans le dropdown du bloc d'envoi tchat.
  const channels = await getCompanyTextChannels(companyId);
  const options = channels.length
    ? channels.map((c) => [`#${c.name}`, c.id])
    : [['(aucun salon)', '0']];

  for (const block of config.blocks) {
    if (block.type === 'action_tchat_send_message' && Array.isArray(block.args0)) {
      const channelArg = block.args0.find((a) => a.name === 'CHANNEL');
      if (channelArg) channelArg.options = options;
    }
  }

  return reply.send(config);
}

async function saveWorkflows(request, reply) {
  const companyId = parseInt(request.headers['x-company-id'], 10);
  const { workflows } = request.body;

  if (!companyId) return reply.status(400).send({ error: "Company ID missing" });

  try {
    const existing = await prisma.companySettings.findUnique({ where: { companyId } });
    const currentSettings = existing?.settings || {};

    const settingsRecord = await prisma.companySettings.upsert({
      where: { companyId },
      update: {
        settings: {
          ...currentSettings,
          automation_workflows: workflows
        }
      },
      create: {
        companyId,
        settings: { automation_workflows: workflows }
      }
    });

    return reply.send({ success: true, workflows: settingsRecord.settings.automation_workflows });
  } catch (error) {
    console.error("[AutomationController] Error saving workflows:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function getWorkflows(request, reply) {
  const companyId = parseInt(request.headers['x-company-id'], 10);
  if (!companyId) return reply.status(400).send({ error: "Company ID missing" });

  try {
    const settingsRecord = await prisma.companySettings.findUnique({
      where: { companyId }
    });

    const workflows = settingsRecord?.settings?.automation_workflows || [];
    return reply.send({ workflows });
  } catch (error) {
    console.error("[AutomationController] Error fetching workflows:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function getTemplates(request, reply) {
  const companyId = parseInt(request.headers['x-company-id'], 10);
  if (!companyId) return reply.status(400).send({ error: "Company ID missing" });

  const scratchModule = await prisma.companyModule.findFirst({
    where: { companyId, module: { name: 'scratch' } }
  });
  if (!scratchModule) {
    return reply.status(403).send({
      error: "Module 'scratch' non activé pour cette entreprise.",
      code: "SCRATCH_MODULE_REQUIRED"
    });
  }

  await registry.scan();
  return reply.send({ templates: registry.getTemplates() });
}

module.exports = {
  getConfig,
  saveWorkflows,
  getWorkflows,
  getTemplates
};
