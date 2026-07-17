# Compta-FlashFA - Gestion Comptable CCA

Application de gestion / comptabilité **FlashFA** : un backend Node.js (Fastify + Prisma)
à architecture *sharded* temps réel, et un frontend React (Vite + MUI).

Démo ici : [Compta Caillou's Clarity Accounting](https://react.jipeg-corporation.eu/)

> Monorepo : `backend/` (API & temps réel) et `frontend/` (interface web).



---

## Sommaire

- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation des dépendances système](#installation-des-dépendances-système)
- [Installation automatique (npm run setup)](#installation-automatique-npm-run-setup)
- [Installation rapide (manuelle)](#installation-rapide-manuelle)
- [Configuration (.env)](#configuration-env)
- [Générer les secrets](#générer-les-secrets)
- [Base de données & migrations](#base-de-données--migrations)
- [Lancer en développement](#lancer-en-développement)
- [Build & production](#build--production)
- [Structure du projet](#structure-du-projet)
- [Services externes](#services-externes)

---

## Stack technique

| Côté | Technologies |
|------|--------------|
| **Backend** | Node.js, Fastify 5, Prisma 6 (**MySQL**), Socket.io, Redis (ioredis), BullMQ, Discord.js, web-push, MinIO/S3 (AWS SDK), Sharp |
| **Frontend** | React 19, Vite, MUI 7, Tailwind CSS, TanStack Query, Socket.io-client, FullCalendar, Blockly |

---

## Prérequis

- **Node.js** ≥ 20 et **npm**
- **MySQL** ≥ 8 (avec une base principale + une base *shadow* pour Prisma)
- **Redis** ≥ 6
- **MinIO** ou un stockage compatible S3 (médias / pièces jointes)
- *(optionnel)* Un **bot Discord** pour le monitoring des shards

---

## Installation des dépendances système

Si Node.js, MySQL, Redis et MinIO ne sont pas encore installés, le wiki fournit un
**guide complet et durci (sécurité)** pour Debian, Ubuntu, Fedora/RHEL et Arch :

➡️ **[wiki/Installation des dépendances](wiki/Installation-des-dependances.md)**

Il couvre, par distribution :

- **Node.js ≥ 20** via `nvm` (sans `root`) ou dépôt officiel signé (GPG)
- **MySQL/MariaDB** : `mysql_secure_installation`, écoute `127.0.0.1`, compte
  applicatif dédié + bases `flashfa` / `flashfa_shadow`
- **Redis** : `requirepass`, `protected-mode`, écoute locale (corrige l'erreur
  `NOAUTH Authentication required`)
- **MinIO** : service systemd, compte root séparé + *service account* à privilèges
  limités pour l'application
- Pare-feu (`ufw` / `firewalld`)

> Bonnes pratiques appliquées : services en écoute locale uniquement, comptes
> dédiés à privilèges minimaux (jamais le `root` de chaque service dans l'app),
> mots de passe forts, dépôts vérifiés par GPG.

Générer un mot de passe fort : `openssl rand -base64 24`

---

## Installation automatique (`npm run setup`)

Une fois MySQL et Redis disponibles, un **installeur interactif** configure tout
automatiquement — la voie recommandée :

```bash
git clone https://github.com/Brillanc3/compta-flashfa.git
cd compta-flashfa/backend
npm install        # installe les dépendances (+ prisma generate)
npm run setup      # assistant d'installation
```

L'assistant :

1. demande la configuration **MySQL / Redis / MinIO / ports** (valeurs par défaut proposées) ;
2. **génère automatiquement** les secrets (`JWT_SECRET`, `SESSION_SECRET`,
   `REFRESH_TOKEN_SALT`…) et la **paire de clés VAPID** ;
3. écrit `backend/.env` (permissions `600`) et `frontend/.env` ;
4. applique les **migrations Prisma** (`prisma migrate deploy`) ;
5. crée un **compte administrateur** (permission `ADMIN.*`) ;
6. crée l'**entreprise parente** (`isParentCompany`) et active ses modules.

### Mode test (aucune modification)

Pour visualiser le déroulé **sans rien écrire** (ni fichier, ni base, ni migration) :

```bash
npm run setup:test     # équivaut à : node scripts/setup.js --dry-run
```

Le mode test affiche le `.env` qui serait généré et le récapitulatif admin/entreprise,
sans toucher au disque ni à la base.

> Saisie des mots de passe masquée. Relancer `npm run setup` proposera de
> conserver un `.env` existant et de ne (re)créer que l'administrateur.

---

## Installation rapide (manuelle)

Alternative à l'installeur, si vous préférez tout configurer à la main :

```bash
# 1. Cloner
git clone https://github.com/Brillanc3/compta-flashfa.git
cd compta-flashfa

# 2. Backend
cd backend
cp .env.example .env          # puis éditer .env (voir ci-dessous)
npm install                   # `prisma generate` se lance automatiquement (postinstall)

# 3. Frontend
cd ../frontend
cp .env.example .env          # puis éditer .env
npm install
```

---

## Configuration (.env)

Chaque dossier possède son propre `.env`, créé à partir du `.env.example` correspondant.
Les fichiers `.env` **ne sont jamais commités** (ignorés par git).

- `backend/.env.example` — base de données, Redis, secrets, MinIO, Discord, VAPID, shards…
- `frontend/.env.example` — uniquement la clé **publique** VAPID (préfixe `VITE_`).

> La clé `VAPID_PUBLIC_KEY` (backend) doit être **identique** à `VITE_VAPID_PUBLIC_KEY` (frontend).

---

## Générer les secrets

> ⚠️ Ne réutilisez jamais de secrets trouvés ailleurs : générez les vôtres.

**Secrets aléatoires** (`JWT_SECRET`, `SESSION_SECRET`, `REFRESH_TOKEN_SALT`,
`AI_INTERNAL_TOKEN`, `DISCORD_REPORT_SECRET`) :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Clés Web Push (VAPID)** — exécuter une fois, reporter la publique côté backend **et** frontend :

```bash
npx web-push generate-vapid-keys
```

**`DATABASE_URL` / `SHADOW_DATABASE_URL`** — chaîne de connexion MySQL :

```
mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:3306/NOM_DE_BASE
```

**Tokens Discord** *(optionnel)* — depuis le
[portail développeur Discord](https://discord.com/developers/applications).

---

## Base de données & migrations

Les migrations Prisma sont versionnées dans `backend/prisma/migrations/`.

```bash
cd backend

# Appliquer toutes les migrations existantes (dev)
npx prisma migrate dev

# En production : appliquer sans générer de nouvelle migration
npx prisma migrate deploy

# (Ré)générer le client Prisma
npx prisma generate

# Données de démarrage (seed)
npm run seed
```

> Prisma a besoin d'une base **shadow** (`SHADOW_DATABASE_URL`) pour calculer les
> migrations en développement. Créez une base MySQL vide dédiée.

---

## Lancer en développement

```bash
# Backend (Master + shards, nodemon)
cd backend
npm run dev        # démarre src/shards/master.js

# Frontend (Vite, hot reload)
cd frontend
npm run dev        # http://localhost:5173 par défaut
```

Le backend écoute par défaut sur `MASTER_PORT` (2500) et le WebSocket sur `WEBSOCKET_PORT` (2505).

---

## Build & production

```bash
# Frontend
cd frontend
npm run build      # génère frontend/dist/
npm run preview    # prévisualiser le build

# Backend
cd backend
npx prisma migrate deploy
npm start          # node src/shards/master.js
```

Des fichiers PM2 (`prod-ecosystem.config.js`, etc.) sont fournis comme base de
déploiement — adaptez-les à votre infrastructure.

---

## Structure du projet

```
compta-flashfa/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # modèle de données (MySQL)
│   │   ├── migrations/          # migrations versionnées
│   │   └── seed.js
│   ├── src/                     # code applicatif (shards, routes, services)
│   ├── scripts/                 # scripts d'exploitation
│   ├── tests/                   # tests (vitest)
│   └── .env.example
├── frontend/
│   ├── src/                     # application React
│   ├── public/
│   └── .env.example
└── README.md
```

---

## Services externes

| Service | Rôle | Variables clés |
|---------|------|----------------|
| **MySQL** | Base de données principale | `DATABASE_URL`, `SHADOW_DATABASE_URL` |
| **Redis** | Cache, sessions, BullMQ, pub/sub Socket.io | `REDIS_URL` |
| **MinIO / S3** | Stockage fichiers & médias | `MINIO_*` |
| **Discord** *(optionnel)* | Monitoring des shards, rapports | `DISCORD_*` |
| **Web Push** | Notifications navigateur | `VAPID_*`, `VITE_VAPID_PUBLIC_KEY` |

---

## Tests

```bash
cd backend
npm test           # vitest
```

Tags: compta, cca, flashfa, compta-flashfa, accounting
