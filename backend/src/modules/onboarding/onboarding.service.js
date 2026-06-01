// /backend/src/modules/onboarding/onboarding.service.js

const prisma = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

/* =========================== Helpers & Logs =========================== */

const asInt = (v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
};

const buildError = (message, scenario = 'ERROR') => {
    const err = new Error(message);
    err.scenario = scenario;
    return err;
};

const log = (...args) => console.log('[onboarding]', ...args);

/**
 * Réaffecte un maximum de relations depuis oldUserId vers newUserId.
 * Chaque bloc est "best effort": en cas d'absence du modèle/champ, on log et on continue.
 * Ajoute ici toutes les tables connues de ton schéma.
 */
async function reassignUserData(tx, oldUserId, newUserId) {
    log(`Fusion: réaffectation des relations de user#${oldUserId} → user#${newUserId}`);

    // Liens 1..N (colonnes userId / authorId / ...):
    const map = [
        // RH / entreprises
        ['companyEmployee', 'userId'],
        ['companyRoleMember', 'userId'],
        // Chat / conversations / tickets
        ['conversationUserMember', 'userId'],
        ['conversationUserMember', 'invitedById'],
        ['message', 'authorId'],
        ['conversation', 'ticketAdminId'],
        // Comptabilité & paie (vu dans ton module comptabilité)
        ['bill', 'authorId'],                               // auteur facture :contentReference
        ['expenseReport', 'authorId'],
        ['expenseReport', 'reviewerId'],
        ['transaction', 'createdById'],
        ['transaction', 'updatedById'],
        // Notifications
        ['notification', 'senderId'],
        ['notificationRecipient', 'userId'],
        // Calendrier
        ['calendarEvent', 'authorId'],
        ['calendarEventAttendee', 'userId'],
        // Divers "ownership"
        ['reportEvent', 'reporterId'],
        ['userWidget', 'userId'],
        ['serviceEvent', 'userId'],
    ];

    for (const [model, column] of map) {
        try {
            const updated = await tx[model].updateMany({
                where: { [column]: oldUserId },
                data: { [column]: newUserId },
            });
            if (updated.count) log(` - ${model}.${column}: ${updated.count} ligne(s) réaffectées`);
        } catch (e) {
            log(` - WARN: ${model}.${column} ignoré (${e?.message || e})`);
        }
    }

    // M:N via relations Prisma (roles, permissions, companies, conversations suivies, etc.)
    // On connecte d'abord sur le destinataire, la suppression du "temp user" nettoiera les liens restants.
    try {
        const temp = await tx.user.findUnique({
            where: { id: oldUserId },
            include: {
                roles: true,
                permissions: true,
                companies: true,
            },
        });

        if (temp) {
            const connectRoles = (temp.roles || []).map((r) => ({ id: r.id }));
            const connectPerms = (temp.permissions || []).map((p) => ({ id: p.id }));
            const connectCompanies = (temp.companies || []).map((c) => ({ id: c.id }));

            if (connectRoles.length || connectPerms.length || connectCompanies.length) {
                const updated = await tx.user.update({
                    where: { id: newUserId },
                    data: {
                        roles: connectRoles.length ? { connect: connectRoles } : undefined,
                        permissions: connectPerms.length ? { connect: connectPerms } : undefined,
                        companies: connectCompanies.length ? { connect: connectCompanies } : undefined,
                    },
                    include: { roles: true, permissions: true, companies: true },
                });
                log(` - M:N connect: roles=${updated.roles?.length || 0}, perms=${updated.permissions?.length || 0}, companies=${updated.companies?.length || 0}`);
            }
        }
    } catch (e) {
        log(' - WARN: M:N connect (roles/permissions/companies) ignoré', e?.message || e);
    }
}

/* =========================== Étape 1 — Préparation =========================== */
/**
 * Vérifie la clé d’onboarding et le couple (ig_character_id, ig_discord_id).
 * Retourne un scénario pour le front.
 */
async function startOnboarding(onboardingKey, ig_character_id, ig_discord_id) {
    const company = await prisma.company.findUnique({ where: { onboardingKey } });
    if (!company) throw buildError("Clé d'onboarding invalide.", 'INVALID_KEY');

    const charId = asInt(ig_character_id);
    const discordId = String(ig_discord_id || '').trim();
    if (!charId || !discordId) throw buildError('Identifiants IG invalides.', 'INVALID_IDS');

    log(`startOnboarding: company#${company.id} (${company.name}) — char=${charId} / discord=${discordId}`);

    // Employé déjà actif pour CETTE entreprise avec CETTE identité
    const activeEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'ACTIVE',
            user: { characterId: charId, discordId: discordId, status: 'ACTIVE' },
        },
        include: { user: true },
    });

    if (activeEmployee) {
        log(` - Déjà lié: user#${activeEmployee.userId}`);
        return {
            scenario: 'ALREADY_LINKED',
            companyName: company.name,
            username: activeEmployee.user.username,
            userName: activeEmployee.user.name,
        };
    }

    // Invitation en attente (doit référencer CETTE identité)
    const pendingEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'PENDING_LINK',
            user: { characterId: charId, discordId: discordId },
        },
        include: { user: true },
    });

    if (!pendingEmployee) {
        // Si un seul des deux IDs matche ailleurs, on renvoie une erreur claire d'identité
        const byChar = await prisma.user.findFirst({ where: { characterId: charId } });
        const byDiscord = await prisma.user.findFirst({ where: { discordId: discordId } });
        if (byChar || byDiscord) throw buildError('Les identifiants fournis ne correspondent pas au même profil.', 'IDENTITY_MISMATCH');

        throw buildError('Aucune invitation trouvée pour ce profil. Contactez un manager.', 'NO_INVITATION');
    }

    if (!pendingEmployee.user || !pendingEmployee.user.name) {
        throw buildError('Invitation invalide ou profil incomplet. Contactez un manager.', 'INVALID_INVITATION');
    }

    // Existe-t-il déjà un user ACTIF globalement pour cette identité ?
    const existingUser = await prisma.user.findFirst({
        where: { characterId: charId, discordId: discordId, status: 'ACTIVE' },
    });

    if (existingUser) {
        log(` - Compte actif déjà existant (hors entreprise): user#${existingUser.id}`);
        return {
            scenario: 'ACCOUNT_EXISTS_NEEDS_LINK',
            companyName: company.name,
            username: existingUser.username,
            properName: pendingEmployee.user.name,
        };
    }

    // Sinon, on proposera une finalisation (création UX) sur le compte temporaire
    const suggestedUsername = pendingEmployee.user.name?.toLowerCase().replace(/\s+/g, '.') || `user.${charId}`;

    return {
        scenario: 'NEEDS_ACCOUNT_CREATION',
        companyName: company.name,
        properName: pendingEmployee.user.name,
        suggestedUsername,
    };
}

/* =========================== Étape 2 — Lier un compte existant =========================== */
/**
 * Fusionne le compte temporaire (PENDING_FINALIZATION) avec un compte existant (login OK).
 * Le résultat final conserve le "compte existant" comme compte unique.
 */
async function linkAccount(onboardingKey, username, password, ig_character_id, ig_discord_id) {
    const company = await prisma.company.findUnique({ where: { onboardingKey } });
    if (!company) throw buildError("Clé d'onboarding invalide.", 'INVALID_KEY');

    const charId = asInt(ig_character_id);
    const discordId = String(ig_discord_id || '').trim();
    if (!charId || !discordId) throw buildError('Identifiants IG invalides.', 'INVALID_IDS');

    const pendingEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'PENDING_LINK',
            user: { characterId: charId, discordId: discordId },
        },
        include: { user: true },
    });
    if (!pendingEmployee) throw buildError('Aucune invitation trouvée pour ce profil.', 'NO_INVITATION');

    const mainUser = await prisma.user.findUnique({
        where: { username },
        include: { roles: true, permissions: true, companies: true },
    });
    if (!mainUser) throw buildError('Utilisateur introuvable.', 'INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(password, mainUser.password);
    if (!ok) throw buildError('Mot de passe incorrect.', 'INVALID_CREDENTIALS');

    // Compte temporaire à fusionner (même identité)
    const tempUser = await prisma.user.findFirst({
        where: { characterId: charId, discordId: discordId, status: 'PENDING_FINALIZATION' },
    });

    log(`linkAccount: fusion → company#${company.id}, tempUser#${tempUser?.id || 'none'} → mainUser#${mainUser.id}`);

    await prisma.$transaction(async (tx) => {
        if (tempUser && tempUser.id !== mainUser.id) {
            // Pour éviter un conflit sur la clé unique composite (discordId, characterId),
            // on déplace temporairement l'identité du compte temporaire (tombstone) avant d'affecter celle du mainUser.
            try {
                await tx.user.update({
                    where: { id: tempUser.id },
                    data: {
                        // "tombstone" garantissant l'unicité pendant la fusion
                        discordId: `TEMP#${tempUser.id}#${tempUser.discordId}`,
                    },
                });
                log(` - Temp identity tombstoned for user#${tempUser.id}`);
            } catch (e) {
                log(' - WARN: tombstone tempUser failed (peut-être non nécessaire):', e?.message || e);
            }

            // Connecter toutes les relations M:N du tempUser -> mainUser (avant delete)
            await reassignUserData(tx, tempUser.id, mainUser.id);

            // On peut supprimer le compte temporaire (les M:N seront nettoyés)
            await tx.user.delete({ where: { id: tempUser.id } });
            log(` - tempUser#${tempUser.id} supprimé`);
        }

        // Mise à jour identité & statut du compte final
        await tx.user.update({
            where: { id: mainUser.id },
            data: {
                characterId: charId,
                discordId: discordId,
                status: 'ACTIVE',
            },
        });
        log(` - mainUser#${mainUser.id} activé + identité IG affectée`);

        // L’employé devient actif pour l’entreprise
        await tx.companyEmployee.update({
            where: { id: pendingEmployee.id },
            data: { userId: mainUser.id, status: 'ACTIVE' },
        });
        log(` - companyEmployee#${pendingEmployee.id} → ACTIVE (user=${mainUser.id})`);
    });

    const finalUser = await prisma.user.findUnique({ where: { id: mainUser.id } });
    const token = jwt.sign(
        { type: 'access', userId: finalUser.id, username: finalUser.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    const { password: _, ...userWithoutPassword } = finalUser;

    return { user: userWithoutPassword, token };
}

/* =========================== Étape 3 — Finaliser (Créer un nouveau compte) =========================== */
/**
 * Finalise le compte temporaire (PENDING_FINALIZATION) en le transformant en compte actif :
 * - change username (si disponible) + password,
 * - status = ACTIVE,
 * - active l’employé pour l’entreprise.
 */
async function createAndLinkAccount(onboardingKey, username, password, ig_character_id, ig_discord_id) {
    const company = await prisma.company.findUnique({ where: { onboardingKey } });
    if (!company) throw buildError("Clé d'onboarding invalide.", 'INVALID_KEY');

    const charId = asInt(ig_character_id);
    const discordId = String(ig_discord_id || '').trim();
    if (!charId || !discordId) throw buildError('Identifiants IG invalides.', 'INVALID_IDS');

    const pendingEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'PENDING_LINK',
            user: { characterId: charId, discordId: discordId },
        },
        include: { user: true },
    });
    if (!pendingEmployee) throw buildError('Aucune invitation trouvée pour ce profil.', 'NO_INVITATION');

    // Vérifier la disponibilité du username (sauf s’il appartient déjà à ce même user temporaire)
    const usernameOwner = await prisma.user.findUnique({ where: { username } });
    if (usernameOwner && usernameOwner.id !== pendingEmployee.userId) {
        throw buildError("Nom d'utilisateur déjà utilisé.", 'USERNAME_TAKEN');
    }

    const tempUser = await prisma.user.findFirst({
        where: { characterId: charId, discordId: discordId, status: 'PENDING_FINALIZATION' },
    });
    if (!tempUser) {
        throw buildError("Profil temporaire introuvable pour cette identité.", 'INVALID_INVITATION');
    }

    log(`createAndLinkAccount: finaliser tempUser#${tempUser.id} (company#${company.id})`);

    const hashed = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
        // Finalise le compte temporaire → devient le compte final
        const finalUser = await tx.user.update({
            where: { id: tempUser.id },
            data: {
                username,
                password: hashed,
                status: 'ACTIVE',
            },
        });
        log(` - tempUser#${tempUser.id} → ACTIVE (username mis à jour)`);

        // L’employé devient actif pour l’entreprise sur ce même userd
        await tx.companyEmployee.update({
            where: { id: pendingEmployee.id },
            data: { userId: finalUser.id, status: 'ACTIVE' },
        });
        log(` - companyEmployee#${pendingEmployee.id} → ACTIVE (user=${finalUser.id})`);
    });

    const finalUser = await prisma.user.findUnique({ where: { id: tempUser.id } });
    const token = jwt.sign(
        { type: 'access', userId: finalUser.id, username: finalUser.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    const { password: _, ...userWithoutPassword } = finalUser;

    return { user: userWithoutPassword, token };
}

/* =========================== Exports =========================== */

module.exports = {
    startOnboarding,
    linkAccount,
    createAndLinkAccount,
};
