// /backend/src/lib/chatCommandHandler.js
const fs = require('fs');
const path = require('path');
const prisma = require('../db');
const { hasPermission } = require('../middleware/auth');
const globalHierarchy = {}; // Placeholder

const commandRegistry = new Map();

/**
 * Charge les définitions de commandes depuis les fichiers *.routes.js des modules actifs.
 */
async function loadChatCommands() {
    console.log('[Chat Commands] Chargement des commandes slash...');
    const modulesDir = path.join(__dirname, '../modules');
    let commandsLoaded = 0;
    try {
        const moduleNames = fs.readdirSync(modulesDir).filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory());
        for (const moduleName of moduleNames) {
            const routeFile = path.join(modulesDir, moduleName, `${moduleName}.routes.js`);
            if (fs.existsSync(routeFile)) {
                const moduleConfig = require(routeFile);
                if (moduleConfig.chatCommands && Array.isArray(moduleConfig.chatCommands)) {
                    for (const commandDef of moduleConfig.chatCommands) {
                        if (commandDef.command && commandDef.serviceFunction) {
                            const commandKey = commandDef.command.startsWith('/') ? commandDef.command.substring(1).toLowerCase() : commandDef.command.toLowerCase();
                            if (commandRegistry.has(commandKey)) { console.warn(`[Chat Commands] Attention: /${commandKey} définie plusieurs fois.`); }
                            commandRegistry.set(commandKey, { ...commandDef, command: commandKey, moduleName: moduleName, context: commandDef.context || 'ANY', });
                            commandsLoaded++;
                        } else { console.warn(`[Chat Commands] Définition invalide dans '${moduleName}'.`); }
                    }
                }
            }
        }
        console.log(`[Chat Commands] ✅ ${commandsLoaded} commandes slash chargées.`);
    } catch (error) { console.error('[Chat Commands] ❌ Erreur critique chargement commandes:', error); process.exit(1); }
}

/**
 * Tente d'exécuter une commande slash après vérification des permissions et du contexte.
 */
async function executeChatCommand(commandName, args, userId, conversationId, conversation, commandArgs = null) {
    const lowerCommandName = commandName.toLowerCase();
    const commandDef = commandRegistry.get(lowerCommandName);
    if (!commandDef) { return null; }

    try {
        // --- Vérification Contexte ---
        if (commandDef.context === 'TICKET' && conversation.type !== 'TICKET') { return { type: 'error', data: `/${lowerCommandName} utilisable en ticket seulement.` }; }

        // --- Vérification Permissions (Logique OU) ---
        // Utiliser requiredPermissions s'il existe, sinon fallback sur requiredPermission
        const permissionsToCheck = commandDef.requiredPermissions || (commandDef.requiredPermission ? [commandDef.requiredPermission] : []);

        if (permissionsToCheck.length > 0) {
            const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { permissions: true } }, permissions: true }, });
            if (!user) throw new Error("Utilisateur introuvable.");

            const userPermissions = new Set();
            user.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));
            user.permissions.forEach(p => userPermissions.add(p.action));

            // Vérifier si l'utilisateur a AU MOINS UNE des permissions requises
            let hasAnyRequiredPermission = false;
            for (const perm of permissionsToCheck) {
                let permissionToCheck = perm; // Utiliser la permission de la boucle
                // Gérer le remplacement de {companyId} (si applicable à la permission)
                if (permissionToCheck.includes('{companyId}')) {
                    if (conversation.companyId) {
                        permissionToCheck = permissionToCheck.replace('{companyId}', conversation.companyId);
                    } else {
                        // Si la permission nécessite companyId mais pas de contexte, on ne peut pas la vérifier pour cette itération
                        continue; // Passer à la permission suivante dans la liste
                    }
                }
                // Vérifier si l'utilisateur a cette permission spécifique
                if (hasPermission(userPermissions, permissionToCheck, globalHierarchy)) {
                    hasAnyRequiredPermission = true;
                    break; // Sortir de la boucle dès qu'une permission correspond
                }
            }

            // Si aucune des permissions requises n'a été trouvée
            if (!hasAnyRequiredPermission) {
                return { type: 'error', data: `Permissions insuffisantes pour exécuter cette commande.` };
            }
        }

        // --- Appel Service ---
        const serviceFile = path.join(__dirname, `../modules/${commandDef.moduleName}/${commandDef.moduleName}.service.js`);
        if (!fs.existsSync(serviceFile)) { throw new Error(`Fichier service introuvable: ${commandDef.moduleName}.`); }
        const moduleService = require(serviceFile);
        const serviceFunction = moduleService[commandDef.serviceFunction];
        if (typeof serviceFunction !== 'function') { throw new Error(`Fonction service '${commandDef.serviceFunction}' introuvable.`); }

        const result = await serviceFunction({ args: commandArgs ? null : args, commandArgs: commandArgs, userId, conversationId, conversation });

        // --- Validation Résultat ---
        if (result && (result.type === 'ephemeral' || result.type === 'message') && result.data) { return result; }
        else if (result && result.type === 'error' && result.data) { return result; }
        else { console.warn(`[Chat Commands] /${lowerCommandName} n'a pas retourné un résultat valide.`); return { type: 'error', data: "Résultat commande invalide." }; }
    } catch (error) {
        console.error(`[Chat Commands] Erreur exécution /${lowerCommandName}:`, error);
        return { type: 'error', data: error.message || "Erreur interne commande." };
    }
}

/**
 * Retourne la liste des commandes disponibles pour un utilisateur, filtrée par permissions/contexte.
 * Gère requiredPermissions (logique OU).
 */
async function getAvailableCommands(userId, companyId = null, conversationType = null) {
    const available = [];
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { permissions: true } }, permissions: true }, });
    if (!user) return [];

    const userPermissions = new Set();
    user.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));
    user.permissions.forEach(p => userPermissions.add(p.action));

    for (const commandDef of commandRegistry.values()) {
        // 1. Vérif Contexte
        if (commandDef.context === 'TICKET' && conversationType !== 'TICKET') continue;
        if (commandDef.context === 'COMPANY' && !companyId) continue;

        // 2. Vérif Permissions (Logique OU)
        const permissionsToCheck = commandDef.requiredPermissions || (commandDef.requiredPermission ? [commandDef.requiredPermission] : []);
        let hasAnyRequiredPermission = true; // Par défaut true s'il n'y a pas de permissions requises

        if (permissionsToCheck.length > 0) {
            hasAnyRequiredPermission = false; // Mettre à false car on doit en trouver au moins une
            for (const perm of permissionsToCheck) {
                let permissionToCheck = perm;
                let canCheckThisPermission = true;

                if (permissionToCheck.includes('{companyId}')) {
                    if (companyId) {
                        permissionToCheck = permissionToCheck.replace('{companyId}', companyId);
                    } else {
                        canCheckThisPermission = false; // Ne peut pas vérifier sans companyId
                    }
                }

                if (canCheckThisPermission && hasPermission(userPermissions, permissionToCheck, globalHierarchy)) {
                    hasAnyRequiredPermission = true;
                    break; // Une seule suffit
                }
            }
        }


        if (hasAnyRequiredPermission) {
            available.push({
                command: `/${commandDef.command}`,
                description: commandDef.description || 'Aucune description',
                parameters: commandDef.parameters || [],
            });
        }
    }
    return available.sort((a, b) => a.command.localeCompare(b.command));
}

module.exports = {
    loadChatCommands,
    executeChatCommand,
    getAvailableCommands,
};