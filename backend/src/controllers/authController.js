// backend/src/controllers/authController.js

const prisma = require('../db'); // Notre client Prisma
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { hasWildcardPermission } = require('../middleware/auth');
const { getUserData } = require('../services/userService'); // Assurez-vous d'importer ce service
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';
const ACCESS_TOKEN_EXPIRATION = '1h';
const SESSION_TOKEN_EXPIRATION = '24h';

// --- FONCTION UTILITAIRE : Création du Jeton de Session (Internalisée) ---
function createSessionToken(userId, name, imageUrl) {
    // Contient uniquement les informations d'affichage non-critiques
    const payload = {
        userId: userId,
        name: name,
        imageUrl: imageUrl, // Pour l'affichage sur l'écran de verrouillage
        type: 'session', // Important pour la vérification dans `unlockSession`
    };
    return jwt.sign(payload, JWT_SECRET, {expiresIn: SESSION_TOKEN_EXPIRATION});
}

// --- FONCTION UTILITAIRE : Création du Jeton d'Accès (Internalisée) ---
// Utilise le même payload que votre fonction login actuelle
function createAccessToken(userId, expiresIn) {
    const payload = { userId: userId, type: 'access' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn });
}

// --- LOGIQUE COMMUNE : Récupérer l'URL de l'image de profil ---
const getProfileImageUrl = async (userId) => {
    const profileImage = await prisma.image.findFirst({
        where: { ownerId: userId, ownerType: 'USER' },
        select: { publicId: true, updatedAt: true }
    });

    // Construit l'URL avec un cache-buster basé sur la date de mise à jour.
    return profileImage
        ? `/api/images/${profileImage.publicId}?v=${profileImage.updatedAt.getTime()}`
        : null;
};

/**
 * "Développe" les permissions joker d'un utilisateur.
 * Si un utilisateur a 'COMPANY.1.*', cette fonction trouvera toutes les permissions
 * existantes qui commencent par 'COMPANY.1.' et les ajoutera à son set de permissions.
 * @param {Set<string>} userPermissions - Le set initial des permissions de l'utilisateur.
 * @returns {Promise<Set<string>>} - Un nouveau set avec les permissions joker développées.
 */
const expandWildcardPermissions = async (userPermissions) => {
    const finalPermissions = new Set(userPermissions);
    const wildcardRegex = /^(COMPANY\.(\d+)\.\*)$/;

    const wildcardPermissions = Array.from(userPermissions).filter(p => wildcardRegex.test(p));

    if (wildcardPermissions.length > 0) {
        for (const wildcard of wildcardPermissions) {
            const prefix = wildcard.replace('*', ''); // ex: 'COMPANY.1.'
            const allMatchingPermissions = await prisma.permission.findMany({
                where: {
                    action: {
                        startsWith: prefix,
                    },
                },
                select: {
                    action: true,
                }
            });
            allMatchingPermissions.forEach(p => finalPermissions.add(p.action));
        }
    }
    return finalPermissions;
};

const calculateUserPermissions = async (user) => {
    const initialPermissions = new Set();
    if (user.roles) {
        user.roles.forEach(role => role.permissions.forEach(p => initialPermissions.add(p.action)));
    }
    if (user.permissions) {
        user.permissions.forEach(p => initialPermissions.add(p.action));
    }
    // On développe les permissions avant de les renvoyer
    const expandedPermissions = await expandWildcardPermissions(initialPermissions);
    return Array.from(expandedPermissions);
};

// Fonction utilitaire pour assembler la liste complète des entreprises d'un utilisateur
const getFullUserCompanies = async (user) => {
    const companyMap = new Map();

    // On récupère en une seule fois l'ensemble des permissions de l'utilisateur
    const allPermissions = new Set();
    (user.roles || []).forEach(role => (role.permissions || []).forEach(p => allPermissions.add(p.action)));
    (user.permissions || []).forEach(p => allPermissions.add(p.action));

    // 1. Traiter les entreprises depuis les contrats de travail (employments)
    if (user.employments) {
        for (const emp of user.employments) {
            if (emp.company) {
                const companyData = {
                    id: emp.company.id,
                    name: emp.company.name,
                };

                // ✅ SÉCURITÉ : On vérifie la permission avant d'ajouter le solde
                const requiredPermission = `COMPANY.${emp.company.id}.BALANCE.VIEW`;
                if (hasWildcardPermission(allPermissions, requiredPermission)) {
                    companyData.balance = emp.company.balance;
                }

                companyMap.set(emp.company.id, companyData);
            }
        }
    }

    // 2. Traiter les entreprises depuis les permissions de gérant
    const managerPermissionRegex = /^COMPANY\.(\d+)\.\*$/;
    const managedCompanyIds = Array.from(allPermissions)
        .map(p => p.match(managerPermissionRegex))
        .filter(Boolean)
        .map(match => parseInt(match[1], 10));

    const newIdsToFetch = managedCompanyIds.filter(id => !companyMap.has(id));
    if (newIdsToFetch.length > 0) {
        const companiesFromPermissions = await prisma.company.findMany({
            where: { id: { in: newIdsToFetch } },
            select: { id: true, name: true, balance: true } // On récupère le solde pour la vérif
        });

        for (const company of companiesFromPermissions) {
            const companyData = {
                id: company.id,
                name: company.name,
            };

            // ✅ SÉCURITÉ : On vérifie aussi la permission ici
            const requiredPermission = `COMPANY.${company.id}.BALANCE.VIEW`;
            if (hasWildcardPermission(allPermissions, requiredPermission)) {
                companyData.balance = company.balance;
            }

            companyMap.set(company.id, companyData);
        }
    }

    return Array.from(companyMap.values());
};
/**
 * Logique pour enregistrer un nouvel utilisateur.
 */
const register = async (request, reply) => {
    try {
        const { name, username, password, characterId } = request.body;

        // 1. Hacher le mot de passe avant de le sauvegarder
        const hashedPassword = await bcrypt.hash(password, 10); // 10 = "salt rounds"

        // 2. Créer l'utilisateur dans la base de données
        const newUser = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                ...(characterId != null ? { characterId: parseInt(characterId, 10) } : {}),
            },
        });

        // On ne renvoie jamais le mot de passe, même haché.
        const { password: _, ...userWithoutPassword } = newUser;
        reply.code(201).send({ user: userWithoutPassword });

    } catch (error) {
        // Gère le cas où le nom d'utilisateur existe déjà (erreur P2002 de Prisma)
        if (error.code === 'P2002') {
            reply.code(409).send({ message: 'Ce nom d\'utilisateur est déjà pris.' });
        } else {
            reply.code(500).send({ message: 'Erreur lors de la création du compte.', error: error.message });
        }
    }
};

/**
 * Logique pour connecter un utilisateur.
 */
const login = async (request, reply) => {
    try {
        const { username, password, duration } = request.body;
        const expiresIn = ['15m', '30m', '60m', '120m'].includes(duration) ? duration : '15m';

        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                roles: { include: { permissions: true } },
                permissions: true,
                employments: {
                    where: { status: 'ACTIVE' },
                    include: {
                        company: true,
                        rank: { include: { permissionTemplates: true } },
                    }
                }
            },
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return reply.code(401).send({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }

        const userCompanies = await getFullUserCompanies(user);
        const permissions = await calculateUserPermissions(user);

        const profileImage = await prisma.image.findFirst({
            where: { ownerId: user.id, ownerType: 'USER' }
        });
        const imageUrl = profileImage
            ? `/api/images/${profileImage.publicId}?v=${profileImage.updatedAt.getTime()}`
            : null;

        const accessToken = createAccessToken(user.id, expiresIn);

        const { password: _, ...userWithoutPassword } = user;

        reply.send({
            accessToken,
            user: { ...userWithoutPassword, permissions, companies: userCompanies, imageUrl },
        });

    } catch (error) {
        // --- BLOC MODIFIÉ ---
        // On log l'erreur complète dans la console du serveur pour le débogage
        console.error("Crash détaillé dans la fonction login :", error);
        // On renvoie un message plus générique au client, mais le détail est dans le log
        reply.code(500).send({ message: 'Une erreur interne est survenue lors de la connexion.' });
        // --- FIN DU BLOC MODIFIÉ ---
    }
};

/**
 * Logique pour récupérer les infos de l'utilisateur actuellement connecté (via son token)
 */
const getMe = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: { include: { permissions: true } },
                permissions: true,
                employments: {
                    where: { status: 'ACTIVE' },
                    include: {
                        company: true,
                        rank: { include: { permissionTemplates: true } },
                        rankHistory: { include: { rank: true }, orderBy: { assignedAt: 'desc' } }
                    }
                }
            },
        });

        if (!user) {
            return reply.code(404).send({ message: 'Utilisateur non trouvé.' });
        }

        const userCompanies = await getFullUserCompanies(user);
        const permissions = await calculateUserPermissions(user);

        // --- BLOC MODIFIÉ ---
        // On cherche l'image de profil et on construit le nouveau lien permanent et sécurisé
        const profileImage = await prisma.image.findFirst({
            where: { ownerId: user.id, ownerType: 'USER' }
        });
        const imageUrl = profileImage
            ? `/api/images/${profileImage.publicId}?v=${profileImage.updatedAt.getTime()}`
            : null;
        // --- FIN DU BLOC MODIFIÉ ---

        const { password, ...userWithoutPassword } = user;

        reply.send({ ...userWithoutPassword, permissions, companies: userCompanies, imageUrl });

    } catch (error) {
        reply.code(500).send({ message: 'Erreur serveur.', error: error.message });
    }
};

/**
 * Rafraîchit un token JWT expiré.
 */
const refreshToken = async (request, reply) => {
    try {
        const { token } = request.body;
        if (!token) {
            return reply.code(401).send({ message: 'Token manquant.' });
        }

        // On vérifie le token mais on ignore sa date d'expiration
        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

        // On s'assure que l'utilisateur existe toujours
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return reply.code(401).send({ message: 'Utilisateur non trouvé.' });
        }

        // On génère un nouveau token avec une nouvelle date d'expiration
        const newToken = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' } // Ou la durée que vous préférez
        );

        // On récupère les données à jour de l'utilisateur à renvoyer au frontend
        const userData = await getUserData(user.id);

        reply.send({
            message: 'Token rafraîchi avec succès.',
            accessToken: newToken,
            user: userData, // On renvoie les données utilisateur à jour
        });

    } catch (err) {
        // Si le token est complètement invalide (pas juste expiré), jwt.verify lèvera une erreur
        reply.code(403).send({ message: 'Token invalide.' });
    }
};

// --- CONTRÔLEUR MODIFIÉ : Déverrouillage de Session ---
async function unlockSession(request, reply) {
    const { sessionToken, password } = request.body;

    if (!sessionToken || !password) {
        return reply.code(400).send({ message: 'Le jeton de session et le mot de passe sont requis.' });
    }

    try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET);
        const { userId, type } = decoded;

        // Vérification de sécurité critique
        if (type !== 'session') {
            return reply.code(401).send({ message: 'Jeton de session invalide. Veuillez vous reconnecter.' });
        }

        // 1. Récupération de l'utilisateur (on récupère le hash pour la vérification)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                password: true, // Le hash du mot de passe
            }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return reply.code(401).send({ message: 'Mot de passe incorrect.' });
        }

        const accessToken = createAccessToken(user.id, user.username);

        return reply.send({
            accessToken,
            user: { id: user.id } // Uniquement l'ID est nécessaire pour le front
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return reply.code(401).send({ message: 'Jeton de session expiré ou invalide. Veuillez vous reconnecter.' });
        }
        request.log.error("Erreur de déverrouillage:", error);
        return reply.code(500).send({ message: 'Erreur interne du serveur.' });
    }
}

// --- NOUVEAU CONTRÔLEUR : Verrouillage de Session ---
// Nécessite un accessToken valide pour fonctionner.
async function lockSession(request, reply) {
    const userId = request.user.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            // CORRIGÉ : On sélectionne uniquement les champs existants
            select: { id: true, name: true }
        });

        if (!user) {
            return reply.code(404).send({ message: 'Utilisateur non trouvé.' });
        }

        const imageUrl = await getProfileImageUrl(userId);

        const sessionToken = createSessionToken(user.id, user.name, imageUrl);

        return reply.send({
            sessionToken,
            user: {
                id: user.id,
                name: user.name,
                imageUrl: imageUrl // Maintenant calculé et existant
            }
        });

    } catch (error) {
        request.log.error("Erreur lors du verrouillage de session:", error);
        return reply.code(500).send({ message: 'Erreur interne du serveur.' });
    }
}


module.exports = {
    register,
    login,
    getMe,
    refreshToken,
    unlockSession,
    lockSession
};