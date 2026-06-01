/**
 * restartShards.js
 * Redémarre les shards (kill + purge Redis) sans couper le master.
 *
 * Usage:
 *   node restartShards.js
 *
 * Options (env):
 *   INCLUDE_GLOBAL=1         -> inclut shard-global (par défaut: 0 => exclu)
 *   ONLY_COMPANY_ID=123      -> ne restart que shard-c-123
 *   WARMUP=1                 -> force une requête via le master pour respawn immédiat
 *   MASTER_PORT=9090         -> port master si WARMUP=1 (par défaut: process.env.MASTER_PORT ou 9090)
 *   SHUTDOWN_TIMEOUT_MS=8000 -> délai SIGTERM avant SIGKILL
 */

require('dotenv').config();
const process = require('process');

const { redis, checkRedisConnection } = require('./src/shards/redisClient');

const INCLUDE_GLOBAL = String(process.env.INCLUDE_GLOBAL || '0') === '1';
const ONLY_COMPANY_ID = process.env.ONLY_COMPANY_ID ? String(process.env.ONLY_COMPANY_ID) : null;
const WARMUP = String(process.env.WARMUP || '0') === '1';
const MASTER_PORT = Number(process.env.MASTER_PORT || 9090);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 8000);

function uniq(arr) {
    return Array.from(new Set(arr));
}

function shardNameToCompanyId(shardName) {
    // shard-global => global
    if (shardName === 'shard-global') return 'global';
    // shard-c-123 => 123
    const m = /^shard-c-(\d+)$/.exec(shardName);
    return m ? m[1] : null;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function killPid(pid, timeoutMs) {
    if (!pid || !Number.isFinite(Number(pid))) return { ok: true, alreadyDead: true };

    const p = Number(pid);
    if (!isPidAlive(p)) return { ok: true, alreadyDead: true };

    try {
        process.kill(p, 'SIGTERM');
    } catch (e) {
        // peut échouer si déjà mort
        return { ok: true, alreadyDead: !isPidAlive(p), error: e?.message };
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!isPidAlive(p)) return { ok: true, killed: 'SIGTERM' };
        await sleep(150);
    }

    // Force kill
    try {
        process.kill(p, 'SIGKILL');
    } catch (e) {
        return { ok: !isPidAlive(p), killed: 'SIGKILL', error: e?.message };
    }

    // petite attente post-kill
    await sleep(150);
    return { ok: !isPidAlive(p), killed: 'SIGKILL' };
}

async function purgeShardKeys(shardName) {
    const shardKeys = await redis.keys(`shard:${shardName}:*`);
    if (shardKeys.length) await redis.del(shardKeys);

    const companyId = shardNameToCompanyId(shardName);
    if (companyId && companyId !== 'global') {
        await redis.del(`company:route:${companyId}`);
    }
}

async function warmupCompany(companyId) {
    // On force un passage par le master pour respawn (même si 404 côté shard, le but est de spawn).
    // Attention: on évite /healthz (global module), on prend un chemin neutre.
    const url = `http://127.0.0.1:${MASTER_PORT}/__warmup`;
    try {
        await fetch(url, {
            method: 'GET',
            headers: {
                'x-company-id': String(companyId),
            },
        });
    } catch {
        // Ignorer: si le master est down, ou autre erreur réseau, on ne bloque pas.
    }
}

async function main() {
    await checkRedisConnection();

    const pidKeys = await redis.keys('shard:shard-*:pid');
    const shardNames = uniq(pidKeys.map((k) => k.split(':')[1]).filter(Boolean));

    let targets = shardNames;

    if (!INCLUDE_GLOBAL) {
        targets = targets.filter((n) => n !== 'shard-global');
    }

    if (ONLY_COMPANY_ID) {
        targets = targets.filter((n) => n === `shard-c-${ONLY_COMPANY_ID}`);
    }

    if (targets.length === 0) {
        console.log('Aucun shard à redémarrer (selon filtres).');
        try { await redis.quit(); } catch {}
        process.exit(0);
    }

    console.log(`Shards trouvés: ${targets.join(', ')}`);

    // 1) Kill PIDs
    for (const shardName of targets) {
        const pid = await redis.get(`shard:${shardName}:pid`);
        console.log(`\n[${shardName}] PID=${pid || 'N/A'} -> arrêt...`);
        const res = await killPid(pid ? Number(pid) : null, SHUTDOWN_TIMEOUT_MS);
        if (!res.ok) {
            console.warn(`[${shardName}] arrêt: échec partiel:`, res);
        } else {
            console.log(`[${shardName}] arrêté (${res.alreadyDead ? 'déjà mort' : res.killed})`);
        }

        // 2) Purge Redis keys (critique pour éviter la réutilisation d'un port mort)
        await purgeShardKeys(shardName);
        console.log(`[${shardName}] clés Redis purgées`);
    }

    // 3) Warmup (optionnel)
    if (WARMUP) {
        const companyIds = targets
            .map(shardNameToCompanyId)
            .filter((cid) => cid && cid !== 'global');

        for (const cid of companyIds) {
            console.log(`[warmup] company ${cid} via master:${MASTER_PORT}`);
            await warmupCompany(cid);
            // petite pause pour éviter un burst
            await sleep(100);
        }
        console.log('[warmup] terminé');
    }

    try { await redis.quit(); } catch {}
    console.log('\n✅ Redémarrage shards terminé (master non impacté).');
    process.exit(0);
}

main().catch(async (e) => {
    console.error('❌ restartShards fatal:', e);
    try { await redis.quit(); } catch {}
    process.exit(1);
});
