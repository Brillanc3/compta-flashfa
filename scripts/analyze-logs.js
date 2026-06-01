'use strict';

const path = require('path');
const prisma = require(path.join(__dirname, '../backend/src/db'));
const fs = require('fs');

// Static handler analysis (from source code review)
const HANDLER_STATIC = {
  create: {
    file: 'billCreate.handler.js',
    currentFieldsUsed: [
      'billId', 'fromPropername', 'toPropername', 'toDiscord', 'characterIdTo',
      'amount', 'reason', 'fromDiscord', 'characterIdFrom'
    ],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['fromPropername', 'toPropername']
  },
  setStatus: {
    file: 'duty.handler.js',
    currentFieldsUsed: ['characterId', 'discord', 'properName', 'status'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  leaveGroup: {
    file: 'leaveGroup.handler.js',
    currentFieldsUsed: ['properName', 'discord', 'discordId', 'characterId'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  acceptInvit: {
    file: 'acceptInvit.handler.js',
    currentFieldsUsed: ['properName', 'discord', 'characterId'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  kickMember: {
    file: 'kickMember.handler.js',
    currentFieldsUsed: ['targetProperName', 'properName'],
    hasCharacterId: false,
    hasDiscordId: false,
    hasNameFields: ['targetProperName', 'properName']
  },
  addmoney: {
    file: 'addMoney.handler.js',
    currentFieldsUsed: [
      'amount', 'reason', 'before', 'after',
      'characterId', 'characterID', 'charId', 'charID',
      'discord', 'discordId', 'discordID',
      'properName', 'name', 'playerName'
    ],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName', 'name', 'playerName']
  },
  add: {
    file: 'inventory.handler.js',
    currentFieldsUsed: ['owner', 'item', 'count', 'metadata', 'properName', 'characterId', 'discord'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  remove: {
    file: 'inventory.handler.js',
    currentFieldsUsed: ['owner', 'item', 'count', 'metadata', 'properName', 'characterId', 'discord'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  upRank: {
    file: 'rankChange.handler.js',
    currentFieldsUsed: ['targetCharacterId', 'newGroupRankId'],
    hasCharacterId: true,
    hasDiscordId: false,
    hasNameFields: []
  },
  downRank: {
    file: 'rankChange.handler.js',
    currentFieldsUsed: ['targetCharacterId', 'newGroupRankId'],
    hasCharacterId: true,
    hasDiscordId: false,
    hasNameFields: []
  },
  garage: {
    file: 'garage.handler.js',
    currentFieldsUsed: ['vehicleId', 'characterId', 'discord', 'properName', 'markerId'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  putInside: {
    file: 'garage.handler.js',
    currentFieldsUsed: ['vehicleId', 'characterId', 'discord', 'properName', 'markerId'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['properName']
  },
  cancel: {
    file: 'cancelBill.handler.js',
    currentFieldsUsed: ['billId', 'source', 'cancellerPropername', 'cancellerDiscord', 'characterIdCanceller'],
    hasCharacterId: true,
    hasDiscordId: true,
    hasNameFields: ['cancellerPropername']
  },
  withdraw: {
    file: 'withdraw.handler.js',
    currentFieldsUsed: ['amount', 'reason', 'before', 'after'],
    hasCharacterId: false,
    hasDiscordId: false,
    hasNameFields: []
  },
  paid: {
    file: 'paidBill.handler.js',
    currentFieldsUsed: ['billId'],
    hasCharacterId: false,
    hasDiscordId: false,
    hasNameFields: []
  },
  paidCash: {
    file: 'paidBill.handler.js',
    currentFieldsUsed: ['billId'],
    hasCharacterId: false,
    hasDiscordId: false,
    hasNameFields: []
  },
  init: {
    file: 'init.handler.js',
    currentFieldsUsed: [],
    hasCharacterId: false,
    hasDiscordId: false,
    hasNameFields: []
  }
};

const LOG_TYPES = Object.keys(HANDLER_STATIC);

async function main() {
  const handlers = {};
  let dbError = null;

  try {
    for (const logType of LOG_TYPES) {
      const staticInfo = HANDLER_STATIC[logType];

      let sampleLogs = [];
      let sampleDataKeys = [];

      try {
        const rows = await prisma.log.findMany({
          where: { logType },
          take: 5,
          orderBy: { id: 'desc' },
          select: { id: true, companyId: true, logType: true, data: true, isProcessed: true, category: true }
        });

        const keySet = new Set();
        sampleLogs = rows.map(row => {
          let parsedData = null;
          try {
            parsedData = JSON.parse(row.data);
            if (parsedData && typeof parsedData === 'object') {
              Object.keys(parsedData).forEach(k => keySet.add(k));
            }
          } catch (_) {
            parsedData = { _parseError: true, raw: row.data };
          }
          return {
            id: row.id,
            companyId: row.companyId,
            isProcessed: row.isProcessed,
            category: row.category,
            parsedData
          };
        });

        sampleDataKeys = Array.from(keySet).sort();
      } catch (err) {
        dbError = err.message;
        console.error(`[${logType}] DB error: ${err.message}`);
      }

      handlers[logType] = {
        ...staticInfo,
        sampleDataKeys,
        sampleLogs,
        ...(dbError ? { dbError } : {})
      };
    }
  } finally {
    await prisma.$disconnect();
  }

  // Build summary
  const handlersWithCharacterId = LOG_TYPES.filter(t => HANDLER_STATIC[t].hasCharacterId);
  const handlersWithDiscordId = LOG_TYPES.filter(t => HANDLER_STATIC[t].hasDiscordId);
  const handlersWithNameFields = LOG_TYPES.filter(t => HANDLER_STATIC[t].hasNameFields.length > 0);

  const output = {
    handlers,
    summary: {
      totalHandlers: LOG_TYPES.length,
      handlersWithCharacterId,
      handlersWithDiscordId,
      handlersWithNameFields,
      ...(dbError ? { dbError } : {})
    }
  };

  const outPath = path.join(__dirname, 'data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outPath}`);

  // Print compact summary
  for (const [logType, info] of Object.entries(handlers)) {
    const count = info.sampleLogs.length;
    const keys = info.sampleDataKeys.join(', ') || '(no samples)';
    console.log(`[${logType}] ${count} samples | keys: ${keys}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
