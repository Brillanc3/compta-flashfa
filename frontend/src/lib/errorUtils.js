// frontend/src/lib/errorUtils.js

import toast from 'react-hot-toast';

/**
 * Gère les erreurs 401 (Unauthorized) et 403 (Forbidden) de manière globale.
 * Cette fonction est appelée par l'intercepteur de réponse Axios.
 *
 * @param {number} status - Le code de statut HTTP.
 */
export const handleGlobalAuthError = (status) => {
    // Évite l'exécution si on n'est pas dans un contexte d'erreur d'authentification/autorisation
    if (status !== 401 && status !== 403) {
        return;
    }

    // 1. Suppression immédiate du token pour éviter toute nouvelle requête
    localStorage.removeItem('accessToken');

    // 2. Message à afficher à l'utilisateur
    let message = 'Une erreur est survenue.';
    if (status === 401) {
        message = 'Votre session a expiré ou votre token est invalide. Veuillez vous reconnecter.';
    } else if (status === 403) {
        message = 'Accès non autorisé. Vous n\'avez pas la permission requise.';
    }

    // 3. Affichage du toast
    // Utilisation d'un ID pour ne pas empiler plusieurs messages identiques
    toast.error(message, { id: 'authError' });

    // 4. Redirection vers la page de connexion
    // On utilise setTimeout pour donner le temps au toast de s'afficher
    setTimeout(() => {
        // Redirection brutale car le token est mort
        window.location.href = '/login';
    }, 1500);
};