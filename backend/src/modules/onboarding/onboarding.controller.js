// /backend/src/modules/onboarding/onboarding.controller.js

const service = require('./onboarding.service');

/**
 * Toutes les routes renvoient 200 OK (jamais 403) et un JSON :
 * { success: boolean, scenario?: string, message?: string, ... }
 */

const startOnboarding = async (request, reply) => {
    try {
        const { onboardingKey, ig_character_id, ig_discord_id } = request.body || {};

        if (!onboardingKey || !ig_character_id || !ig_discord_id) {
            return reply.code(200).send({
                success: false,
                scenario: 'INVALID_REQUEST',
                message: "Paramètres manquants (onboardingKey, ig_character_id, ig_discord_id).",
            });
        }

        const data = await service.startOnboarding(onboardingKey, ig_character_id, ig_discord_id);
        return reply.code(200).send({ success: true, ...data });
    } catch (error) {
        console.error('[onboarding] startOnboarding error:', error?.message || error);
        return reply.code(200).send({
            success: false,
            scenario: error.scenario || 'ERROR',
            message: error.message || 'Erreur interne du serveur',
        });
    }
};

const linkAccount = async (request, reply) => {
    try {
        const { onboardingKey, username, password, ig_character_id, ig_discord_id } = request.body || {};

        if (!onboardingKey || !username || !password || !ig_character_id || !ig_discord_id) {
            return reply.code(200).send({
                success: false,
                scenario: 'INVALID_REQUEST',
                message: 'Paramètres manquants.',
            });
        }

        const result = await service.linkAccount(onboardingKey, username, password, ig_character_id, ig_discord_id);
        return reply.code(200).send({ success: true, ...result });
    } catch (error) {
        console.error('[onboarding] linkAccount error:', error?.message || error);
        return reply.code(200).send({
            success: false,
            scenario: error.scenario || 'ERROR',
            message: error.message || 'Erreur lors de la liaison.',
        });
    }
};

const createAndLinkAccount = async (request, reply) => {
    try {
        const { onboardingKey, username, password, ig_character_id, ig_discord_id } = request.body || {};

        if (!onboardingKey || !username || !password || !ig_character_id || !ig_discord_id) {
            return reply.code(200).send({
                success: false,
                scenario: 'INVALID_REQUEST',
                message: 'Paramètres manquants.',
            });
        }

        const result = await service.createAndLinkAccount(onboardingKey, username, password, ig_character_id, ig_discord_id);
        return reply.code(200).send({ success: true, ...result });
    } catch (error) {
        console.error('[onboarding] createAndLinkAccount error:', error?.message || error);
        return reply.code(200).send({
            success: false,
            scenario: error.scenario || 'ERROR',
            message: error.message || 'Erreur lors de la création.',
        });
    }
};

module.exports = {
    startOnboarding,
    linkAccount,
    createAndLinkAccount,
};
