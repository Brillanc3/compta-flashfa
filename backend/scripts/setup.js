#!/usr/bin/env node
/**
 * Installeur interactif de compta-flashfa.
 *
 *   npm run setup            # installation réelle
 *   npm run setup:test       # mode test (--dry-run) : aucune écriture, aucune DB
 *
 * Étapes :
 *   1. Configuration interactive (MySQL, Redis, MinIO, ports)
 *   2. Génération automatique des secrets + clés VAPID
 *   3. Écriture de backend/.env et frontend/.env
 *   4. Application des migrations Prisma (prisma migrate deploy)
 *   5. Création d'un compte administrateur (permission ADMIN.*)
 *   6. Création de l'entreprise parente
 *
 * Mode test (--dry-run / --test) :
 *   - n'écrit AUCUN fichier (affiche le .env qui serait généré)
 *   - n'exécute PAS les migrations
 *   - n'écrit RIEN en base (affiche seulement le récapitulatif)
 *
 * Aucune dépendance supplémentaire : n'utilise que les modules déjà installés
 * (crypto, readline, child_process, @prisma/client, bcrypt, web-push).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--test');

const BACKEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');
const BACKEND_ENV = path.join(BACKEND_DIR, '.env');
const FRONTEND_ENV = path.join(ROOT_DIR, 'frontend', '.env');

/* ----------------------------- Helpers I/O ----------------------------- */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Masquage de saisie (mots de passe) via le hook d'écriture de readline.
let muted = false;
rl._writeToOutput = function (str) {
  if (muted) {
    if (str.includes('\n')) rl.output.write('\n');
    return;
  }
  rl.output.write(str);
};

// File d'attente des lignes : fiable en TTY ET en pipe (contrairement à
// rl.question() en série qui ne lit que la 1re ligne sur une entrée non-TTY).
const lineQueue = [];
const lineWaiters = [];
rl.on('line', (line) => {
  if (lineWaiters.length) lineWaiters.shift()(line);
  else lineQueue.push(line);
});
function nextLine() {
  return new Promise((resolve) => {
    if (lineQueue.length) resolve(lineQueue.shift());
    else lineWaiters.push(resolve);
  });
}

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};

function title(t) {
  console.log(`\n${c.bold}${c.cyan}== ${t} ==${c.reset}`);
}

async function ask(question, def = '') {
  const hint = def ? ` ${c.dim}(${def})${c.reset}` : '';
  process.stdout.write(`${question}${hint} : `);
  const answer = (await nextLine()).trim();
  return answer || def;
}

async function askYesNo(question, def = true) {
  const ans = (await ask(`${question} ${def ? '[O/n]' : '[o/N]'}`)).toLowerCase();
  if (!ans) return def;
  return ans === 'o' || ans === 'oui' || ans === 'y' || ans === 'yes';
}

/** Saisie masquée (mot de passe) : coupe l'écho pendant la frappe. */
async function askHidden(question) {
  process.stdout.write(`${question} : `);
  muted = true;
  const value = await nextLine();
  muted = false;
  process.stdout.write('\n');
  return value.trim();
}

async function askPasswordTwice(label) {
  for (;;) {
    const a = await askHidden(label);
    if (a.length < 6) { console.log(`${c.red}x Minimum 6 caracteres.${c.reset}`); continue; }
    const b = await askHidden(`${label} (confirmation)`);
    if (a !== b) { console.log(`${c.red}x Les mots de passe ne correspondent pas.${c.reset}`); continue; }
    return a;
  }
}

const genSecret = () => crypto.randomBytes(48).toString('hex');

/* ------------------------------ Étapes ------------------------------ */

async function collectConfig() {
  title('Base de donnees (MySQL)');
  const dbHost = await ask('Hote MySQL', '127.0.0.1');
  const dbPort = await ask('Port MySQL', '3306');
  const dbUser = await ask('Utilisateur MySQL', 'flashfa');
  const dbPass = await askHidden('Mot de passe MySQL');
  const dbName = await ask('Base de donnees', 'flashfa');
  const dbShadow = await ask('Base shadow (migrations Prisma)', 'flashfa_shadow');

  const enc = encodeURIComponent;
  const auth = `${enc(dbUser)}:${enc(dbPass)}`;
  const databaseUrl = `mysql://${auth}@${dbHost}:${dbPort}/${dbName}`;
  const shadowUrl = `mysql://${auth}@${dbHost}:${dbPort}/${dbShadow}`;

  title('Redis');
  const redisHost = await ask('Hote Redis', '127.0.0.1');
  const redisPort = await ask('Port Redis', '6379');
  const redisPass = await askHidden('Mot de passe Redis (vide si aucun)');
  const redisUrl = redisPass
    ? `redis://:${encodeURIComponent(redisPass)}@${redisHost}:${redisPort}`
    : `redis://${redisHost}:${redisPort}`;

  title('MinIO (stockage fichiers) - optionnel');
  const useMinio = await askYesNo('Configurer MinIO maintenant ?', false);
  const minio = { endpoint: 'http://127.0.0.1:9000', bucket: 'tchatv2', publicUrl: 'http://127.0.0.1:9000', accessKey: '', secretKey: '' };
  if (useMinio) {
    minio.endpoint = await ask('MINIO_ENDPOINT', minio.endpoint);
    minio.bucket = await ask('MINIO_BUCKET', minio.bucket);
    minio.publicUrl = await ask('MINIO_PUBLIC_URL', minio.endpoint);
    minio.accessKey = await ask('MINIO_ACCESS_KEY_ID');
    minio.secretKey = await askHidden('MINIO_SECRET_ACCESS_KEY');
  }

  title('Ports de l\'application');
  const masterPort = await ask('Port du Master (API)', '2500');
  const wsPort = await ask('Port du WebSocket', '2505');

  title('Web Push (VAPID)');
  const vapidSubject = await ask('Sujet VAPID (mailto:...)', 'mailto:contact@example.com');

  return { databaseUrl, shadowUrl, redisUrl, minio, masterPort, wsPort, vapidSubject };
}

function buildEnv(cfg, secrets, vapid) {
  const m = cfg.minio;
  return `# Genere par npm run setup le ${new Date().toISOString()}
TZ='Europe/Paris'
ENV=dev

# Base de donnees (MySQL via Prisma)
DATABASE_URL="${cfg.databaseUrl}"
SHADOW_DATABASE_URL="${cfg.shadowUrl}"

# Redis
REDIS_URL="${cfg.redisUrl}"

# Secrets / Auth
JWT_SECRET=${secrets.jwt}
SESSION_SECRET=${secrets.session}
REFRESH_TOKEN_SALT=${secrets.refresh}
PROFANITY_CUSTOM_WORDS=

# IA (optionnel)
AI_LOCAL_URL=http://127.0.0.1:4050/ask
AI_INTERNAL_TOKEN=${secrets.ai}

# Bot Discord (optionnel)
DISCORD_TOKEN=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_STATUS_CHANNEL_ID=
DISCORD_REPORT_CHANNEL_ID=
DISCORD_REPORT_SECRET=${secrets.discordReport}

# Systeme de shards
FASTIFY_LOG_LEVEL=debug
MASTER_PORT=${cfg.masterPort}
WEBSOCKET_PORT=${cfg.wsPort}
SHARD_BASE_PORT=3000
BASE_SHARD_PORT=10000
SHARD_IDLE_TTL_MS=3600000
SHARD_WAIT_TIMEOUT=5000
SHARD_TTL=600

# MinIO / S3
MINIO_ENDPOINT=${m.endpoint}
MINIO_BUCKET=${m.bucket}
MINIO_PUBLIC_URL=${m.publicUrl}
MINIO_ACCESS_KEY_ID=${m.accessKey}
MINIO_SECRET_ACCESS_KEY=${m.secretKey}
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=

# Web Push (VAPID)
VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}
VAPID_SUBJECT=${cfg.vapidSubject}
`;
}

function runPrisma(args, env) {
  if (DRY_RUN) {
    console.log(`${c.yellow}[test] migrations ignorees (npx prisma ${args.join(' ')}).${c.reset}`);
    return true;
  }
  const res = spawnSync('npx', ['prisma', ...args], { cwd: BACKEND_DIR, stdio: 'inherit', env: { ...process.env, ...env } });
  return res.status === 0;
}

async function createAdminAndCompany(databaseUrl) {
  if (DRY_RUN) {
    title('Compte administrateur (mode test)');
    const name = await ask('Nom affiche de l\'admin', 'Administrateur');
    const username = await ask('Nom d\'utilisateur (login)', 'admin');
    await askPasswordTwice('Mot de passe admin');
    title('Entreprise parente (mode test)');
    const companyName = await ask('Nom de l\'entreprise parente', 'Entreprise Parente');
    console.log(`${c.yellow}[test] Aucune ecriture en base.${c.reset}`);
    console.log(`${c.dim}Serait cree :${c.reset} admin « ${username} » (${name}) + entreprise « ${companyName} » (isParentCompany=true).`);
    console.log(`${c.dim}Permissions admin :${c.reset} ADMIN.*, ADMIN.PANEL.ACCESS, COMPANY.<id entreprise parente>.*`);
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcrypt');
  const prisma = new PrismaClient();

  try {
    title('Creation du compte administrateur');
    const name = await ask('Nom affiche de l\'admin', 'Administrateur');
    let username;
    for (;;) {
      username = await ask('Nom d\'utilisateur (login)');
      if (!username) { console.log(`${c.red}x Obligatoire.${c.reset}`); continue; }
      if (await prisma.user.findUnique({ where: { username } })) { console.log(`${c.red}x Ce login existe deja.${c.reset}`); continue; }
      break;
    }
    const password = await askPasswordTwice('Mot de passe admin');

    title('Creation de l\'entreprise parente');
    const existingParent = await prisma.company.findFirst({ where: { isParentCompany: true } });
    if (existingParent) {
      console.log(`${c.yellow}! Une entreprise parente existe deja : « ${existingParent.name} ».${c.reset}`);
      if (await askYesNo('Conserver l\'existante et ne creer que l\'admin ?', true)) {
        await createAdmin(prisma, bcrypt, { name, username, password, company: existingParent });
        return;
      }
    }
    let companyName;
    for (;;) {
      companyName = await ask('Nom de l\'entreprise parente', 'Entreprise Parente');
      if (await prisma.company.findUnique({ where: { name: companyName } })) { console.log(`${c.red}x Ce nom existe deja.${c.reset}`); continue; }
      break;
    }

    const company = await prisma.company.create({ data: { name: companyName, isParentCompany: true, isApiActive: true } });
    console.log(`${c.green}+ Entreprise parente creee (id ${company.id}).${c.reset}`);

    const modules = await prisma.module.findMany();
    for (const mod of modules) {
      await prisma.companyModule.upsert({
        where: { companyId_moduleId: { companyId: company.id, moduleId: mod.id } },
        update: {}, create: { companyId: company.id, moduleId: mod.id },
      });
    }
    if (modules.length) console.log(`${c.green}+ ${modules.length} modules actives.${c.reset}`);

    await createAdmin(prisma, bcrypt, { name, username, password, company });
  } finally {
    await prisma.$disconnect();
  }
}

async function createAdmin(prisma, bcrypt, { name, username, password, company }) {
  // Permissions accordées à l'administrateur :
  //  - ADMIN.*              : super-admin global (court-circuite toute vérification)
  //  - ADMIN.PANEL.ACCESS   : accès au panneau d'administration
  //  - COMPANY.<id>.*       : tous droits sur l'entreprise parente
  const actions = ['ADMIN.*', 'ADMIN.PANEL.ACCESS', `COMPANY.${company.id}.*`];
  const permissions = [];
  for (const action of actions) {
    permissions.push(await prisma.permission.upsert({ where: { action }, update: {}, create: { action } }));
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name, username, password: hashed, status: 'ACTIVE',
      permissions: { connect: permissions.map((p) => ({ id: p.id })) },
      companies: { connect: { id: company.id } },
    },
  });
  const rank = await prisma.rank.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Gérant' } },
    update: {}, create: { name: 'Gérant', position: 1, companyId: company.id },
  });
  await prisma.companyEmployee.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { rankId: rank.id, status: 'ACTIVE' },
    create: { companyId: company.id, userId: user.id, rankId: rank.id, status: 'ACTIVE' },
  });
  console.log(`${c.green}+ Administrateur « ${username} » cree avec les permissions ${actions.join(', ')}${c.reset}`);
}

/* ------------------------------- Main ------------------------------- */

async function main() {
  console.log(`${c.bold}${c.cyan}\n=== Installation de compta-flashfa ===${c.reset}`);
  if (DRY_RUN) console.log(`${c.yellow}MODE TEST (--dry-run) : aucune ecriture fichier ni base.${c.reset}`);

  if (!DRY_RUN && fs.existsSync(BACKEND_ENV)) {
    if (!(await askYesNo(`${c.yellow}backend/.env existe deja. L'ecraser ?${c.reset}`, false))) {
      console.log(`${c.dim}Conservation du .env existant.${c.reset}`);
      const dbUrl = (fs.readFileSync(BACKEND_ENV, 'utf8').match(/^DATABASE_URL="?(.+?)"?$/m) || [])[1];
      if (!dbUrl) { console.log(`${c.red}DATABASE_URL introuvable. Abandon.${c.reset}`); rl.close(); return; }
      if (await askYesNo('Appliquer les migrations Prisma ?', true)) runPrisma(['migrate', 'deploy'], { DATABASE_URL: dbUrl });
      if (await askYesNo('Creer un administrateur maintenant ?', true)) await createAdminAndCompany(dbUrl);
      finish(); rl.close(); return;
    }
  }

  const cfg = await collectConfig();
  const secrets = { jwt: genSecret(), session: genSecret(), refresh: genSecret(), ai: genSecret(), discordReport: genSecret() };

  let vapid = { publicKey: '', privateKey: '' };
  try { vapid = require('web-push').generateVAPIDKeys(); }
  catch { console.log(`${c.yellow}! web-push indisponible - cles VAPID vides (lancez « npm install »).${c.reset}`); }

  const envContent = buildEnv(cfg, secrets, vapid);
  if (DRY_RUN) {
    title('Contenu .env qui serait genere (mode test)');
    console.log(envContent);
  } else {
    fs.writeFileSync(BACKEND_ENV, envContent, { mode: 0o600 });
    console.log(`${c.green}+ backend/.env ecrit (permissions 600).${c.reset}`);
    if (fs.existsSync(path.dirname(FRONTEND_ENV))) {
      fs.writeFileSync(FRONTEND_ENV, `VITE_VAPID_PUBLIC_KEY=${vapid.publicKey}\n`);
      console.log(`${c.green}+ frontend/.env ecrit.${c.reset}`);
    }
  }

  title('Migrations Prisma');
  if (!runPrisma(['migrate', 'deploy'], { DATABASE_URL: cfg.databaseUrl })) {
    console.log(`${c.red}x Echec des migrations. Verifiez MySQL puis relancez « npm run setup ».${c.reset}`);
    rl.close(); return;
  }

  if (DRY_RUN || await askYesNo('Creer l\'administrateur et l\'entreprise parente maintenant ?', true)) {
    await createAdminAndCompany(cfg.databaseUrl);
  }

  finish(); rl.close();
}

function finish() {
  console.log(`\n${c.bold}${c.green}${DRY_RUN ? 'Test termine (aucune modification).' : 'Installation terminee.'}${c.reset}`);
  if (!DRY_RUN) {
    console.log(`${c.dim}Backend :${c.reset}  npm run dev`);
    console.log(`${c.dim}Frontend :${c.reset} (cd ../frontend && npm run dev)\n`);
  }
}

main().catch((e) => { console.error(`${c.red}Erreur :${c.reset}`, e); rl.close(); process.exit(1); });
