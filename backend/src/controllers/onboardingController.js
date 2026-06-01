// backend/src/controllers/onboardingController.js

const prisma = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { CompanyEmployeeStatus, UserStatus } = require('@prisma/client');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

/**
 * Étape 1 : Prépare les informations pour le frontend.
 */
const startOnboarding = async (request, reply) => {
    const { onboardingKey, ig_character_id } = request.body;
    const characterId = parseInt(ig_character_id, 10);

    const company = await prisma.company.findUnique({ where: { onboardingKey } });
    if (!company) {
        return reply.code(404).send({ message: "Configuration d'accueil introuvable." });
    }

    // --- LOGIQUE CORRIGÉE ET INVERSÉE ---

    // 1. On cherche d'ABORD si un VRAI compte (statut ACTIF) est déjà employé de cette entreprise.
    const activeEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'ACTIVE',
            user: {
                characterId: characterId,
                status: 'ACTIVE'
            }
        },
        include: { user: true }
    });

    // Cas A : L'employé est trouvé. Il doit juste se reconnecter.
    if (activeEmployee) {
        const profileImage = await prisma.image.findFirst({ where: { ownerId: activeEmployee.userId, ownerType: 'USER' } });
        const imageUrl = profileImage ? `/api/images/${profileImage.publicId}?v=${profileImage.updatedAt.getTime()}` : null;

        return reply.send({
            scenario: 'ALREADY_LINKED',
            companyName: company.name,
            username: activeEmployee.user.username,
            userName: activeEmployee.user.name, // On ajoute le nom complet pour l'affichage
            imageUrl: imageUrl,
        });
    }

    // 2. SI AUCUN EMPLOYÉ ACTIF N'EST TROUVÉ, ALORS on cherche une invitation en attente.
    const pendingEmployee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: company.id,
            status: 'PENDING_LINK', // Le statut de l'emploi doit être PENDING_LINK
            user: {
                characterId: characterId,
                // ON AJOUTE CETTE CONDITION CRUCIALE :
                status: 'PENDING_FINALIZATION' // Le statut de l'utilisateur doit être PENDING_FINALIZATION
            },
        },
        include: { user: true }
    });

    if (!pendingEmployee) {
        return reply.code(404).send({ message: "Aucune invitation en attente trouvée." });
    }

    // Si l'invitation est trouvée mais que le compte est bloqué
    if (pendingEmployee.failedLinkAttempts >= 3) {
        return reply.code(403).send({ message: "Ce profil a été bloqué suite à trop de tentatives. Veuillez contacter un manager." });
    }

    // 3. On décide du scénario de liaison/création.
    const mainUserAccount = await prisma.user.findFirst({
        where: { characterId: characterId, status: 'ACTIVE' }
    });

    // Cas B : Un compte existe déjà mais n'est pas lié à CETTE entreprise.
    if (mainUserAccount) {
        return reply.send({
            scenario: 'ACCOUNT_EXISTS_NEEDS_LINK',
            companyName: company.name,
            properName: pendingEmployee.user.name,
            username: mainUserAccount.username,
        });
    }

    // Cas C : Aucun compte n'existe, il faut le créer.
    return reply.send({
        scenario: 'NEEDS_ACCOUNT_CREATION',
        companyName: company.name,
        properName: pendingEmployee.user.name,
        suggestedUsername: pendingEmployee.user.name.toLowerCase().replace(/\s/g, '.'),
    });
};



/**
 * Étape 2 (Cas A) : L'utilisateur se connecte pour lier son compte.
 */
const linkAccount = async (request, reply) => {
    const { username, password, characterId } = request.body;

    const mainUser = await prisma.user.findUnique({ where: { username } });
    if (!mainUser || !(await bcrypt.compare(password, mainUser.password))) {
        return reply.code(401).send({ message: 'Identifiants incorrects.' });
    }

    await prisma.$transaction(async (tx) => {
        // 1. On trouve l'enregistrement temporaire pour récupérer les infos
        const tempEmployee = await tx.companyEmployee.findFirst({
            where: { user: { characterId }, status: 'PENDING_LINK' },
            include: { user: true }
        });
        if (!tempEmployee) throw new Error("Invitation introuvable.");

        const tempUser = tempEmployee.user;

        // --- BLOC CORRIGÉ ---

        // 2. NOUVELLE ÉTAPE : On libère le characterId du compte temporaire
        // pour éviter le conflit de contrainte unique.
        await tx.user.update({
            where: { id: tempUser.id },
            data: { characterId: null },
        });

        // 3. On met à jour le compte principal avec TOUTES les informations nécessaires
        await tx.user.update({
            where: { id: mainUser.id },
            data: {
                name: tempUser.name,
                characterId: tempUser.characterId,
                discordId: tempUser.discordId,
            },
        });

        // 4. On lie l'employé au compte principal
        await tx.companyEmployee.update({
            where: { id: tempEmployee.id },
            data: { userId: mainUser.id, status: 'ACTIVE' },
        });

        // 5. On supprime l'utilisateur temporaire qui ne sert plus à rien
        await tx.user.delete({ where: { id: tempUser.id } });

        // --- FIN DU BLOC CORRIGÉ ---
    });

    const finalUser = await prisma.user.findUnique({ where: { id: mainUser.id }});
    const token = jwt.sign({ userId: finalUser.id, username: finalUser.username }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = finalUser;

    reply.send({ user: userWithoutPassword, token });
};



/**
 * Étape 2 (Cas B) : Crée un utilisateur et le lie.
 */
const createAndLinkAccount = async (request, reply) => {
    const { username, password, characterId } = request.body;

    if (await prisma.user.findUnique({ where: { username } })) {
        return reply.code(409).send({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
    }

    let updatedUser;
    await prisma.$transaction(async (tx) => {
        // 1. On trouve l'enregistrement temporaire
        const tempEmployee = await tx.companyEmployee.findFirst({
            where: { user: { characterId }, status: 'PENDING_LINK' },
            include: { user: true }
        });
        if (!tempEmployee) throw new Error("Invitation introuvable.");

        // 2. On met à jour l'utilisateur temporaire pour en faire un vrai compte
        const hashedPassword = await bcrypt.hash(password, 10);
        updatedUser = await tx.user.update({
            where: { id: tempEmployee.userId },
            data: {
                username: username,
                password: hashedPassword,
                status: 'ACTIVE',
                // Le nom est déjà le bon, on n'y touche pas
            },
        });

        // 3. On active la liaison employé
        await tx.companyEmployee.update({
            where: { id: tempEmployee.id },
            data: { status: 'ACTIVE' },
        });
    });

    const token = jwt.sign({ userId: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = updatedUser;
    reply.code(201).send({ user: userWithoutPassword, token });
};


module.exports = {
    startOnboarding,
    linkAccount,
    createAndLinkAccount,
};