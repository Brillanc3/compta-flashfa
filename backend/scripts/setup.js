#!/usr/bin/env node
/**
 * Installeur complet de compta-flashfa (style "projet pro prêt à déployer").
 *
 *   npm run setup            # installation réelle
 *   npm run setup:test       # mode test (--dry-run) : aucune écriture, aucune DB, aucune commande système
 *
 * Étapes :
 *   1. Vérification des dépendances système (node, npm, serveur web, certbot…)
 *   2. Configuration interactive (MySQL, Redis, MinIO, ports, domaine, SSL)
 *   3. Génération automatique des secrets + clés VAPID
 *   4. Écriture de backend/.env et frontend/.env
 *   5. Application des migrations Prisma (prisma migrate deploy)
 *   6. Build du frontend (npm install + vite build)
 *   7. Création automatique du vhost (Nginx ou Apache2) — reverse proxy + SPA
 *   8. Génération automatique du certificat SSL (certbot Let's Encrypt)
 *   9. Service systemd optionnel pour le backend
 *  10. Création d'un compte administrateur + entreprise parente
 *
 * Architecture servie (domaine unique) :
 *   https://<domaine>/            -> frontend statique (frontend/dist, fallback SPA)
 *   https://<domaine>/api/        -> proxy vers le Master (MASTER_PORT)
 *   https://<domaine>/socket.io/  -> proxy WebSocket vers le Master
 *
 * Mode test (--dry-run / --test) :
 *   - n'écrit AUCUN fichier, n'exécute AUCUNE commande système, n'écrit RIEN en base.
 *
 * Aucune dépendance npm supplémentaire : crypto, readline, child_process, os,
 * @prisma/client, bcrypt, web-push (déjà installés).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--test');

const BACKEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const FRONTEND_DIST = path.join(FRONTEND_DIR, 'dist');
const BACKEND_ENV = path.join(BACKEND_DIR, '.env');
const FRONTEND_ENV = path.join(FRONTEND_DIR, '.env');

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

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

// File d'attente des lignes : fiable en TTY ET en pipe.
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
  // Couleurs de texte
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
  white: '\x1b[97m', black: '\x1b[30m', gray: '\x1b[90m',
  // Couleurs de fond
  bgGreen: '\x1b[42m', bgRed: '\x1b[41m', bgYellow: '\x1b[43m',
  bgCyan: '\x1b[46m', bgBlue: '\x1b[44m', bgGray: '\x1b[100m',
};

// Couleurs désactivées si la sortie n'est pas un terminal (logs, pipe, CI).
const COLOR = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (codes, s) => (COLOR ? `${codes}${s}${c.reset}` : s);

/** Pastille colorée : texte sur fond plein (style « badge » pro). */
function badge(text, bg, fg = c.white) {
  return paint(`${bg}${fg}${c.bold}`, ` ${text} `);
}

/** Bannière encadrée centrée. */
function banner(text) {
  const w = text.length + 6;
  const bar = '═'.repeat(w);
  const c1 = COLOR ? `${c.bold}${c.cyan}` : '';
  const c0 = COLOR ? c.reset : '';
  console.log(`\n${c1}╔${bar}╗${c0}`);
  console.log(`${c1}║   ${text}   ║${c0}`);
  console.log(`${c1}╚${bar}╝${c0}`);
}

function title(t) {
  console.log(`\n${paint(`${c.bgBlue}${c.white}${c.bold}`, `  ${t}  `)}`);
}
const ok = (m) => console.log(`${badge('OK', c.bgGreen, c.black)} ${m}`);
const warn = (m) => console.log(`${badge('!', c.bgYellow, c.black)} ${paint(c.yellow, m)}`);
const err = (m) => console.log(`${badge('X', c.bgRed)} ${paint(c.red, m)}`);
const info = (m) => console.log(`${paint(c.dim, m)}`);

/**
 * Ligne d'état d'une dépendance avec pastille de fond :
 *   vert = installé, rouge = manquant, jaune = manquant mais optionnel.
 */
function depRow(label, present, { optional = false, hint = '' } = {}) {
  let b;
  if (present) b = badge('INSTALLÉ ', c.bgGreen, c.black);
  else if (optional) b = badge('OPTIONNEL', c.bgYellow, c.black);
  else b = badge('MANQUANT ', c.bgRed);
  const h = hint ? `  ${paint(c.dim, hint)}` : '';
  console.log(`  ${b}  ${paint(c.bold, label)}${h}`);
}

async function ask(question, def = '') {
  const hint = def ? ` ${c.dim}(${def})${c.reset}` : '';
  process.stdout.write(`${question}${hint} : `);
  const answer = (await nextLine()).trim();
  return answer || def;
}

async function askRequired(question, def = '') {
  for (;;) {
    const v = await ask(question, def);
    if (v) return v;
    err('Obligatoire.');
  }
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
    if (a.length < 6) { err('Minimum 6 caracteres.'); continue; }
    const b = await askHidden(`${label} (confirmation)`);
    if (a !== b) { err('Les mots de passe ne correspondent pas.'); continue; }
    return a;
  }
}

const genSecret = () => crypto.randomBytes(48).toString('hex');

/* --------------------------- Helpers système --------------------------- */

/** La commande existe-t-elle dans le PATH ? */
function has(cmd) {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

/**
 * Exécute une commande. Avec { priv:true }, préfixe par sudo si on n'est pas root.
 * Renvoie true si succès (status 0). En DRY_RUN : log + true.
 */
function sysRun(cmd, args, { priv = false, input, label } = {}) {
  const printable = `${cmd} ${args.join(' ')}`;
  if (DRY_RUN) { warn(`[test] commande ignorée : ${printable}`); return true; }
  const useSudo = priv && !IS_ROOT;
  const bin = useSudo ? 'sudo' : cmd;
  const finalArgs = useSudo ? [cmd, ...args] : args;
  if (label) info(`$ ${useSudo ? 'sudo ' : ''}${printable}`);
  const res = spawnSync(bin, finalArgs, {
    stdio: input != null ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input,
  });
  return res.status === 0;
}

/** Écrit un fichier dans un emplacement privilégié (utilise sudo tee si non-root). */
function writeFilePriv(dest, content) {
  if (DRY_RUN) {
    warn(`[test] écrirait ${dest} :`);
    info(content.split('\n').map((l) => `    ${l}`).join('\n'));
    return true;
  }
  if (IS_ROOT) {
    fs.writeFileSync(dest, content);
    return true;
  }
  const res = spawnSync('sudo', ['tee', dest], { input: content, stdio: ['pipe', 'ignore', 'inherit'] });
  return res.status === 0;
}

/* ------------------------ Vérification dépendances ------------------------ */

function checkDependencies() {
  title('Vérification des dépendances système');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const caps = {
    node: nodeMajor >= 18,
    npm: has('npm'),
    nginx: has('nginx'),
    apache: has('apache2') || has('apachectl') || has('apache2ctl'),
    certbot: has('certbot'),
    systemctl: has('systemctl'),
    apt: has('apt-get'),
    mysql: has('mysql'),
    redisCli: has('redis-cli'),
    sudo: IS_ROOT || has('sudo'),
  };

  depRow(`Node.js ${process.versions.node}`, caps.node, { hint: caps.node ? '' : '>= 18 requis' });
  depRow('npm', caps.npm);
  depRow('Nginx', caps.nginx, { optional: true, hint: caps.nginx ? '' : 'installable via apt' });
  depRow('Apache2', caps.apache, { optional: true, hint: caps.apache ? '' : 'installable via apt' });
  depRow('certbot (SSL)', caps.certbot, { optional: true, hint: caps.certbot ? '' : 'installable via apt' });
  depRow('systemctl', caps.systemctl, { optional: true });
  depRow('client mysql', caps.mysql, { optional: true });
  depRow('redis-cli', caps.redisCli, { optional: true });
  depRow(IS_ROOT ? 'privilèges root' : 'sudo', caps.sudo);

  if (!caps.node) err('Version de Node trop ancienne — mettez à jour avant de continuer.');
  if (!caps.npm) err('npm introuvable — requis pour le build.');
  if (!IS_ROOT && !caps.sudo) warn('Ni root ni sudo : les étapes web/SSL/systemd échoueront.');

  return caps;
}

/* ----------------------------- Config base ----------------------------- */

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

/* --------------------------- Config déploiement --------------------------- */

async function collectDeployConfig(caps) {
  title('Déploiement web (reverse proxy + SSL)');
  if (!(await askYesNo('Configurer le serveur web + SSL maintenant ?', true))) return null;

  const domain = await askRequired('Nom de domaine (ex: app.exemple.com)');

  // Choix du serveur web.
  let server;
  if (caps.nginx && caps.apache) {
    info('Nginx et Apache2 sont tous deux installés.');
    const a = (await ask('Lequel utiliser ? [nginx/apache]', 'nginx')).toLowerCase();
    server = a.startsWith('a') ? 'apache' : 'nginx';
  } else if (caps.nginx) {
    server = 'nginx'; info('Nginx détecté.');
  } else if (caps.apache) {
    server = 'apache'; info('Apache2 détecté.');
  } else {
    warn('Aucun serveur web détecté.');
    const a = (await ask('Lequel installer ? [nginx/apache]', 'nginx')).toLowerCase();
    server = a.startsWith('a') ? 'apache' : 'nginx';
  }

  const needInstallServer = server === 'nginx' ? !caps.nginx : !caps.apache;

  // SSL : certbot automatique (Let's Encrypt).
  let ssl = await askYesNo('Générer le certificat SSL avec certbot (Let\'s Encrypt) ?', true);
  let email = '';
  if (ssl) email = await askRequired('Email pour Let\'s Encrypt (notifications/expiration)');

  // Service systemd backend.
  const systemd = caps.systemctl
    ? await askYesNo('Créer un service systemd pour démarrer le backend automatiquement ?', false)
    : false;

  return { domain, server, needInstallServer, ssl, email, systemd };
}

/* ------------------------------ Frontend ------------------------------ */

function buildFrontend() {
  title('Build du frontend');
  if (!fs.existsSync(FRONTEND_DIR)) { warn('Dossier frontend introuvable — build ignoré.'); return false; }
  if (DRY_RUN) { warn('[test] npm install + npm run build dans frontend ignorés.'); return true; }

  info('Installation des dépendances frontend (npm install)…');
  if (spawnSync('npm', ['install'], { cwd: FRONTEND_DIR, stdio: 'inherit' }).status !== 0) {
    err('Échec de npm install (frontend).'); return false;
  }
  info('Build du frontend (vite build)…');
  if (spawnSync('npm', ['run', 'build'], { cwd: FRONTEND_DIR, stdio: 'inherit' }).status !== 0) {
    err('Échec du build frontend.'); return false;
  }
  ok(`Frontend buildé dans ${FRONTEND_DIST}.`);
  return true;
}

/* --------------------------- Génération vhost --------------------------- */

function nginxVhost(domain, masterPort) {
  return `# compta-flashfa — généré par npm run setup
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    root ${FRONTEND_DIST};
    index index.html;

    client_max_body_size 50m;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API backend (Master)
    location /api/ {
        proxy_pass http://127.0.0.1:${masterPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket (socket.io) — proxy vers le Master
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${masterPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    # Health check
    location = /healthz {
        proxy_pass http://127.0.0.1:${masterPort};
    }
}
`;
}

function apacheVhost(domain, masterPort) {
  return `# compta-flashfa — généré par npm run setup
<VirtualHost *:80>
    ServerName ${domain}
    DocumentRoot ${FRONTEND_DIST}

    ProxyPreserveHost On
    ProxyRequests Off

    # WebSocket (socket.io) — doit précéder les ProxyPass HTTP
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/socket\\.io/(.*) ws://127.0.0.1:${masterPort}/socket.io/$1 [P,L]

    ProxyPass /api/ http://127.0.0.1:${masterPort}/api/
    ProxyPassReverse /api/ http://127.0.0.1:${masterPort}/api/
    ProxyPass /socket.io/ http://127.0.0.1:${masterPort}/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:${masterPort}/socket.io/
    ProxyPass /healthz http://127.0.0.1:${masterPort}/healthz
    ProxyPassReverse /healthz http://127.0.0.1:${masterPort}/healthz

    LimitRequestBody 52428800

    <Directory ${FRONTEND_DIST}>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        # Fallback SPA (hors chemins proxifiés)
        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_URI} !^/(api|socket\\.io|healthz)
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
`;
}

function setupNginx(deploy, masterPort) {
  const conf = nginxVhost(deploy.domain, masterPort);
  const dest = `/etc/nginx/sites-available/${deploy.domain}.conf`;
  const link = `/etc/nginx/sites-enabled/${deploy.domain}.conf`;

  if (!writeFilePriv(dest, conf)) { err('Écriture du vhost nginx échouée.'); return false; }
  ok(`vhost écrit : ${dest}`);
  sysRun('ln', ['-sf', dest, link], { priv: true });
  if (!sysRun('nginx', ['-t'], { priv: true })) { err('nginx -t a échoué — vhost non rechargé.'); return false; }
  if (!sysRun('systemctl', ['reload', 'nginx'], { priv: true })) {
    sysRun('systemctl', ['restart', 'nginx'], { priv: true });
  }
  ok('Nginx rechargé.');
  return true;
}

function setupApache(deploy, masterPort) {
  const conf = apacheVhost(deploy.domain, masterPort);
  const dest = `/etc/apache2/sites-available/${deploy.domain}.conf`;

  // Modules requis pour le reverse proxy + WebSocket + SPA.
  sysRun('a2enmod', ['proxy', 'proxy_http', 'proxy_wstunnel', 'rewrite', 'headers'], { priv: true });

  if (!writeFilePriv(dest, conf)) { err('Écriture du vhost apache échouée.'); return false; }
  ok(`vhost écrit : ${dest}`);
  sysRun('a2ensite', [`${deploy.domain}.conf`], { priv: true });
  if (!sysRun('apache2ctl', ['configtest'], { priv: true })) { err('configtest apache a échoué — vhost non rechargé.'); return false; }
  if (!sysRun('systemctl', ['reload', 'apache2'], { priv: true })) {
    sysRun('systemctl', ['restart', 'apache2'], { priv: true });
  }
  ok('Apache2 rechargé.');
  return true;
}

function setupWebServer(deploy, masterPort, caps) {
  title(`Serveur web (${deploy.server})`);

  // Installation du serveur web si manquant.
  if (deploy.needInstallServer) {
    if (!caps.apt) { err('apt-get indisponible — installez le serveur web manuellement.'); return false; }
    const pkg = deploy.server === 'nginx' ? 'nginx' : 'apache2';
    info(`Installation de ${pkg}…`);
    sysRun('apt-get', ['update'], { priv: true });
    if (!sysRun('apt-get', ['install', '-y', pkg], { priv: true })) { err(`Installation de ${pkg} échouée.`); return false; }
  }

  return deploy.server === 'nginx' ? setupNginx(deploy, masterPort) : setupApache(deploy, masterPort);
}

/* -------------------------------- SSL -------------------------------- */

function setupSSL(deploy, caps) {
  if (!deploy.ssl) return;
  title('Certificat SSL (Let\'s Encrypt)');

  if (!caps.certbot) {
    if (!caps.apt) { err('certbot absent et apt-get indisponible — SSL ignoré.'); return; }
    const plugin = deploy.server === 'nginx' ? 'python3-certbot-nginx' : 'python3-certbot-apache';
    info('Installation de certbot…');
    sysRun('apt-get', ['update'], { priv: true });
    if (!sysRun('apt-get', ['install', '-y', 'certbot', plugin], { priv: true })) { err('Installation de certbot échouée.'); return; }
  }

  const flag = deploy.server === 'nginx' ? '--nginx' : '--apache';
  const args = [flag, '-d', deploy.domain, '--non-interactive', '--agree-tos', '--redirect', '-m', deploy.email];
  if (sysRun('certbot', args, { priv: true, label: true })) {
    ok(`Certificat SSL actif pour ${deploy.domain} (renouvellement auto via certbot.timer).`);
  } else {
    err('certbot a échoué. Vérifiez que le domaine pointe sur ce serveur (DNS A/AAAA) puis relancez :');
    info(`  sudo certbot ${args.join(' ')}`);
  }
}

/* ------------------------------ systemd ------------------------------ */

function setupSystemd(deploy) {
  if (!deploy || !deploy.systemd) return;
  title('Service systemd (backend)');

  const user = process.env.SUDO_USER || os.userInfo().username;
  const unit = `[Unit]
Description=compta-flashfa backend (Master)
After=network.target mysql.service redis-server.service

[Service]
Type=simple
User=${user}
WorkingDirectory=${BACKEND_DIR}
ExecStart=/usr/bin/env npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
  const dest = '/etc/systemd/system/flashfa-backend.service';
  if (!writeFilePriv(dest, unit)) { err('Écriture du service systemd échouée.'); return; }
  ok(`Service écrit : ${dest}`);
  sysRun('systemctl', ['daemon-reload'], { priv: true });
  if (sysRun('systemctl', ['enable', '--now', 'flashfa-backend'], { priv: true })) {
    ok('Service flashfa-backend activé et démarré.');
  } else {
    warn('Service écrit mais non démarré. Lancez : sudo systemctl enable --now flashfa-backend');
  }
}

/* ----------------------------- Prisma / DB ----------------------------- */

function runPrisma(args, env) {
  if (DRY_RUN) {
    warn(`[test] migrations ignorees (npx prisma ${args.join(' ')}).`);
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
    warn('[test] Aucune ecriture en base.');
    info(`Serait cree : admin « ${username} » (${name}) + entreprise « ${companyName} » (isParentCompany=true).`);
    info('Permissions admin : ADMIN.*, ADMIN.PANEL.ACCESS, COMPANY.<id entreprise parente>.*');
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
      if (!username) { err('Obligatoire.'); continue; }
      if (await prisma.user.findUnique({ where: { username } })) { err('Ce login existe deja.'); continue; }
      break;
    }
    const password = await askPasswordTwice('Mot de passe admin');

    title('Creation de l\'entreprise parente');
    const existingParent = await prisma.company.findFirst({ where: { isParentCompany: true } });
    if (existingParent) {
      warn(`Une entreprise parente existe deja : « ${existingParent.name} ».`);
      if (await askYesNo('Conserver l\'existante et ne creer que l\'admin ?', true)) {
        await createAdmin(prisma, bcrypt, { name, username, password, company: existingParent });
        return;
      }
    }
    let companyName;
    for (;;) {
      companyName = await ask('Nom de l\'entreprise parente', 'Entreprise Parente');
      if (await prisma.company.findUnique({ where: { name: companyName } })) { err('Ce nom existe deja.'); continue; }
      break;
    }

    const company = await prisma.company.create({ data: { name: companyName, isParentCompany: true, isApiActive: true } });
    ok(`Entreprise parente creee (id ${company.id}).`);

    const modules = await prisma.module.findMany();
    for (const mod of modules) {
      await prisma.companyModule.upsert({
        where: { companyId_moduleId: { companyId: company.id, moduleId: mod.id } },
        update: {}, create: { companyId: company.id, moduleId: mod.id },
      });
    }
    if (modules.length) ok(`${modules.length} modules actives.`);

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
  ok(`Administrateur « ${username} » cree avec les permissions ${actions.join(', ')}`);
}

/* --------------------------- Étape déploiement --------------------------- */

/** Exécute build front + web server + SSL + systemd. masterPort = port du Master. */
function runDeployment(deploy, masterPort, caps) {
  if (!deploy) return;
  buildFrontend();
  setupWebServer(deploy, masterPort, caps);
  setupSSL(deploy, caps);
  setupSystemd(deploy);
}

/* ------------------------------- Main ------------------------------- */

async function main() {
  banner('Installation de compta-flashfa');
  if (DRY_RUN) console.log(`${badge('MODE TEST', c.bgYellow, c.black)} aucune ecriture fichier, base ni commande système.`);

  const caps = checkDependencies();
  if (!caps.node || !caps.npm) { err('Dépendances de base manquantes. Abandon.'); rl.close(); return; }

  /* --- Cas : un .env existe déjà --- */
  if (!DRY_RUN && fs.existsSync(BACKEND_ENV)) {
    if (!(await askYesNo(`${c.yellow}backend/.env existe deja. L'ecraser ?${c.reset}`, false))) {
      info('Conservation du .env existant.');
      const envText = fs.readFileSync(BACKEND_ENV, 'utf8');
      const dbUrl = (envText.match(/^DATABASE_URL="?(.+?)"?$/m) || [])[1];
      const masterPort = (envText.match(/^MASTER_PORT=(\d+)/m) || [])[1] || '2500';
      if (!dbUrl) { err('DATABASE_URL introuvable. Abandon.'); rl.close(); return; }

      if (await askYesNo('Appliquer les migrations Prisma ?', true)) runPrisma(['migrate', 'deploy'], { DATABASE_URL: dbUrl });

      const deploy = await collectDeployConfig(caps);
      runDeployment(deploy, masterPort, caps);

      if (await askYesNo('Creer un administrateur maintenant ?', true)) await createAdminAndCompany(dbUrl);
      finish(deploy); rl.close(); return;
    }
  }

  /* --- Installation complète --- */
  const cfg = await collectConfig();
  const deploy = await collectDeployConfig(caps);

  const secrets = { jwt: genSecret(), session: genSecret(), refresh: genSecret(), ai: genSecret(), discordReport: genSecret() };

  let vapid = { publicKey: '', privateKey: '' };
  try { vapid = require('web-push').generateVAPIDKeys(); }
  catch { warn('web-push indisponible - cles VAPID vides (lancez « npm install »).'); }

  // Écriture des .env
  const envContent = buildEnv(cfg, secrets, vapid);
  if (DRY_RUN) {
    title('Contenu .env qui serait genere (mode test)');
    console.log(envContent);
  } else {
    fs.writeFileSync(BACKEND_ENV, envContent, { mode: 0o600 });
    ok('backend/.env ecrit (permissions 600).');
    if (fs.existsSync(FRONTEND_DIR)) {
      fs.writeFileSync(FRONTEND_ENV, `VITE_VAPID_PUBLIC_KEY=${vapid.publicKey}\n`);
      ok('frontend/.env ecrit.');
    }
  }

  // Migrations
  title('Migrations Prisma');
  if (!runPrisma(['migrate', 'deploy'], { DATABASE_URL: cfg.databaseUrl })) {
    err('Echec des migrations. Verifiez MySQL puis relancez « npm run setup ».');
    rl.close(); return;
  }

  // Déploiement (front build + web server + SSL + systemd)
  runDeployment(deploy, cfg.masterPort, caps);

  // Admin + entreprise
  if (DRY_RUN || await askYesNo('Creer l\'administrateur et l\'entreprise parente maintenant ?', true)) {
    await createAdminAndCompany(cfg.databaseUrl);
  }

  finish(deploy); rl.close();
}

function finish(deploy) {
  console.log('');
  console.log(DRY_RUN
    ? `${badge('TEST OK', c.bgYellow, c.black)} ${paint(c.bold, 'Aucune modification effectuée.')}`
    : `${badge('SUCCÈS', c.bgGreen, c.black)} ${paint(c.bold, 'Installation terminée.')}`);
  if (DRY_RUN) return;

  if (deploy && deploy.domain) {
    const scheme = deploy.ssl ? 'https' : 'http';
    console.log(`${c.dim}Application :${c.reset} ${scheme}://${deploy.domain}`);
    if (deploy.systemd) {
      console.log(`${c.dim}Backend :${c.reset}  systemctl status flashfa-backend`);
    } else {
      console.log(`${c.dim}Backend :${c.reset}  npm start ${c.dim}(ou npm run dev)${c.reset}`);
    }
  } else {
    console.log(`${c.dim}Backend :${c.reset}  npm run dev`);
    console.log(`${c.dim}Frontend :${c.reset} (cd ../frontend && npm run dev)`);
  }
  console.log('');
}

main().catch((e) => { console.error(`${c.red}Erreur :${c.reset}`, e); rl.close(); process.exit(1); });
