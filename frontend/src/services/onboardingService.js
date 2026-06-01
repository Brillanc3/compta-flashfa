// /frontend/src/services/onboardingService.js
import apiClient from './api';

export const startOnboarding = async (params) => {
    try {
        const response = await apiClient.post('/onboarding/start', params);
        return response.data;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            'Erreur inconnue lors du démarrage de l’onboarding.';
        console.error("Erreur startOnboarding:", message);
        throw { message };
    }
};

export const linkAccount = async (payload) => {
    try {
        const response = await apiClient.post('/onboarding/link', payload);
        return response.data;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            'Erreur lors de la liaison du compte.';
        throw { message };
    }
};

export const createAndLinkAccount = async (payload) => {
    try {
        const response = await apiClient.post('/onboarding/create', payload);
        return response.data;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            'Erreur lors de la création du compte.';
        throw { message };
    }
};
