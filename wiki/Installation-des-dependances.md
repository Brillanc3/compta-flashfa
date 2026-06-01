# Installation des dépendances système

Guide d'installation **et de durcissement** des services requis par compta-flashfa :

| Service | Rôle | Version conseillée |
|---------|------|--------------------|
| **Node.js** + npm | Exécution backend & build frontend | ≥ 20 LTS |
| **MySQL** (ou MariaDB) | Base de données principale + shadow | MySQL ≥ 8 / MariaDB ≥ 10.6 |
| **Redis** | Cache, sessions, BullMQ, pub/sub Socket.io | ≥ 6 |
| **MinIO** | Stockage S3 des fichiers & médias | dernière release stable |

> **Principe de sécurité appliqué partout :** services en écoute sur `127.0.0.1`
> uniquement, comptes applicatifs **dédiés et à privilèges minimaux** (jamais le
> compte `root` de chaque service dans l'application), mots de passe forts générés
> aléatoirement, pas de `curl | bash` (on vérifie toujours les clés GPG des dépôts).

Générer un mot de passe fort :

```bash
openssl rand -base64 24
```

**Sommaire**

- [0. Préparation](#0-préparation)
- [1. Node.js ≥ 20 + npm](#1-nodejs--20--npm)
- [2. MySQL](#2-mysql)
- [3. Redis](#3-redis)
- [4. MinIO](#4-minio)
- [5. Récapitulatif des variables .env](#5-récapitulatif-des-variables-env)
- [6. Pare-feu (recommandé)](#6-pare-feu-recommandé)

---

## 0. Préparation

**Debian / Ubuntu**

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y ca-certificates curl gnupg lsb-release
```

**Fedora / RHEL / Rocky / AlmaLinux**

```bash
sudo dnf -y upgrade
sudo dnf install -y curl gnupg2 ca-certificates
```

**Arch / Manjaro**

```bash
sudo pacman -Syu --noconfirm
sudo pacman -S --noconfirm curl
```

---

## 1. Node.js ≥ 20 + npm

### Option A — gestionnaire de version `nvm` (recommandé, sans `root`)

Isole Node de la distribution, facilite les mises à jour, n'installe rien en `root` :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Recharger le shell, puis :
nvm install 20
nvm use 20
node -v   # doit afficher v20.x
```

### Option B — dépôt officiel par distribution

**Debian / Ubuntu (NodeSource, avec vérification GPG)**

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update && sudo apt install -y nodejs
```

**Fedora / RHEL**

```bash
sudo dnf module reset nodejs -y
sudo dnf module install nodejs:20/common -y
```

**Arch / Manjaro**

```bash
sudo pacman -S --noconfirm nodejs-lts-iron npm   # 20.x (« Iron »)
```

> ⚠️ N'exécutez jamais `npm` ou l'application en `root`. Créez un utilisateur
> système dédié pour le déploiement (`sudo adduser --system --group flashfa`).

---

## 2. MySQL

### Installation

**Ubuntu**

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

**Debian** (fournit MariaDB sous le nom `default-mysql-server` — compatible Prisma) :

```bash
sudo apt install -y default-mysql-server
sudo systemctl enable --now mariadb
```

**Fedora / RHEL**

```bash
sudo dnf install -y mysql-server
sudo systemctl enable --now mysqld
```

**Arch / Manjaro** (MariaDB) :

```bash
sudo pacman -S --noconfirm mariadb
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
sudo systemctl enable --now mariadb
```

### Durcissement

Lancer l'assistant de sécurisation (définit le mot de passe `root`, supprime les
comptes anonymes, la base `test`, et l'accès `root` distant) :

```bash
sudo mysql_secure_installation
```

Restreindre l'écoute à la boucle locale. Éditer le fichier de config
(`/etc/mysql/mysql.conf.d/mysqld.cnf` sur Ubuntu, `/etc/my.cnf.d/*.cnf` sur
Fedora/Arch) :

```ini
[mysqld]
bind-address = 127.0.0.1
```

Puis redémarrer le service (`sudo systemctl restart mysql` / `mariadb` / `mysqld`).

### Création des bases et de l'utilisateur applicatif

> On crée un compte **dédié** à privilèges limités aux deux bases du projet —
> jamais le compte `root` dans `DATABASE_URL`.

```bash
sudo mysql   # ou : mysql -u root -p
```

```sql
CREATE DATABASE flashfa        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE flashfa_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'flashfa'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE_FORT';
GRANT ALL PRIVILEGES ON flashfa.*        TO 'flashfa'@'localhost';
GRANT ALL PRIVILEGES ON flashfa_shadow.* TO 'flashfa'@'localhost';
FLUSH PRIVILEGES;
```

La base `flashfa_shadow` est requise par Prisma pour calculer les migrations en
développement (voir `SHADOW_DATABASE_URL`).

**Variables `.env` correspondantes :**

```ini
DATABASE_URL="mysql://flashfa:MOT_DE_PASSE_FORT@127.0.0.1:3306/flashfa"
SHADOW_DATABASE_URL="mysql://flashfa:MOT_DE_PASSE_FORT@127.0.0.1:3306/flashfa_shadow"
```

---

## 3. Redis

### Installation

**Debian / Ubuntu**

```bash
sudo apt install -y redis-server
```

**Fedora / RHEL**

```bash
sudo dnf install -y redis
```

**Arch / Manjaro**

```bash
sudo pacman -S --noconfirm redis
```

### Durcissement

Éditer la configuration (`/etc/redis/redis.conf`, ou `/etc/redis.conf` sur
Fedora/Arch) :

```conf
# Écoute locale uniquement
bind 127.0.0.1 -::1
protected-mode yes

# Authentification obligatoire (corrige l'erreur « NOAUTH Authentication required »)
requirepass MOT_DE_PASSE_REDIS_FORT

# Intégration systemd
supervised systemd

# (optionnel) neutraliser des commandes dangereuses
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG ""
```

Activer et redémarrer :

```bash
sudo systemctl enable --now redis-server   # Debian/Ubuntu
# ou : sudo systemctl enable --now redis    # Fedora/Arch
sudo systemctl restart redis-server         # / redis
```

Vérifier l'authentification :

```bash
redis-cli -a 'MOT_DE_PASSE_REDIS_FORT' ping   # -> PONG
```

**Variable `.env` correspondante** (mot de passe inclus dans l'URL) :

```ini
REDIS_URL="redis://:MOT_DE_PASSE_REDIS_FORT@127.0.0.1:6379"
```

---

## 4. MinIO

MinIO fournit le stockage S3 des médias. On l'installe en service systemd, avec un
compte **root** d'administration et un **compte de service à privilèges limités**
pour l'application.

### Installation du binaire (Debian/Ubuntu/Fedora/RHEL)

```bash
# Binaire serveur
curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio \
  -o /tmp/minio
sudo install -m 755 /tmp/minio /usr/local/bin/minio

# Client d'administration « mc »
curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc \
  -o /tmp/mc
sudo install -m 755 /tmp/mc /usr/local/bin/mc
```

**Arch / Manjaro** (paquet officiel) :

```bash
sudo pacman -S --noconfirm minio minio-client
```

### Utilisateur système, données et configuration

```bash
sudo useradd -r -s /sbin/nologin minio-user || true
sudo mkdir -p /srv/minio/data
sudo chown -R minio-user:minio-user /srv/minio
```

Fichier d'environnement `/etc/default/minio` (droits restreints, contient les
identifiants root) :

```ini
MINIO_VOLUMES="/srv/minio/data"
# Écoute API locale + console d'admin locale
MINIO_OPTS="--address 127.0.0.1:9000 --console-address 127.0.0.1:9001"
MINIO_ROOT_USER=admin_flashfa
MINIO_ROOT_PASSWORD=MOT_DE_PASSE_ROOT_FORT
```

```bash
sudo chmod 600 /etc/default/minio
sudo chown root:root /etc/default/minio
```

Service systemd `/etc/systemd/system/minio.service` :

```ini
[Unit]
Description=MinIO
After=network-online.target
Wants=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minio
```

### Bucket + compte de service dédié à l'application

> ⚠️ Ne mettez **pas** les identifiants `root` MinIO dans l'application. On crée un
> *service account* (clé d'accès limitée) à mettre dans le `.env`.

```bash
mc alias set local http://127.0.0.1:9000 admin_flashfa MOT_DE_PASSE_ROOT_FORT

# Créer le bucket attendu par l'app
mc mb local/tchatv2

# Créer une clé d'accès applicative dédiée
mc admin user svcaccount add local admin_flashfa
# -> renvoie « Access Key » et « Secret Key » à reporter dans le .env
```

> **TLS / production :** exposez MinIO derrière un reverse proxy HTTPS (Nginx,
> Caddy…) et renseignez `MINIO_PUBLIC_URL` avec l'URL publique `https://`. En
> local, `http://localhost:9000` suffit.

**Variables `.env` correspondantes :**

```ini
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_BUCKET=tchatv2
MINIO_PUBLIC_URL=http://127.0.0.1:9000
MINIO_ACCESS_KEY_ID=<Access Key du service account>
MINIO_SECRET_ACCESS_KEY=<Secret Key du service account>
MINIO_ROOT_USER=admin_flashfa
MINIO_ROOT_PASSWORD=MOT_DE_PASSE_ROOT_FORT
```

---

## 5. Récapitulatif des variables .env

Une fois les services installés, reportez ces valeurs dans `backend/.env`
(copié depuis `backend/.env.example`) :

```ini
DATABASE_URL="mysql://flashfa:****@127.0.0.1:3306/flashfa"
SHADOW_DATABASE_URL="mysql://flashfa:****@127.0.0.1:3306/flashfa_shadow"
REDIS_URL="redis://:****@127.0.0.1:6379"
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_BUCKET=tchatv2
MINIO_ACCESS_KEY_ID=****
MINIO_SECRET_ACCESS_KEY=****
```

Secrets applicatifs (`JWT_SECRET`, `SESSION_SECRET`, `REFRESH_TOKEN_SALT`…) et
clés VAPID : voir la section *Générer les secrets* du
[README](../README.md#générer-les-secrets).

Vérifier que tout répond :

```bash
mysql -u flashfa -p -e "SELECT 1;"                 # MySQL
redis-cli -a '****' ping                            # Redis -> PONG
mc ls local                                         # MinIO -> liste les buckets
```

---

## 6. Pare-feu (recommandé)

Les services écoutent sur `127.0.0.1`, mais un pare-feu reste conseillé pour
n'exposer que ce qui est nécessaire (HTTP/HTTPS, SSH).

**Ubuntu / Debian (ufw)**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

**Fedora / RHEL (firewalld)**

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

Les ports `3306` (MySQL), `6379` (Redis) et `9000/9001` (MinIO) ne doivent
**jamais** être ouverts publiquement.
