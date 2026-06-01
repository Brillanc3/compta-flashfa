// frontend/src/utils/serviceUtils.js

/**
 * Groups services into sessions based on user and time proximity.
 * @param {Array} services - Array of service objects [{id, userId, startTime, endTime, author, ...}]
 * @param {number} thresholdMinutes - Maximum gap between services to consider them part of the same session.
 * @returns {Array} Array of session objects
 */
export const groupServicesIntoSessions = (services, thresholdMinutes = 15) => {
    if (!services || services.length === 0) return [];

    // Trier par utilisateur puis par heure de début
    const sorted = [...services].sort((a, b) => {
        if (a.userId !== b.userId) return a.userId - b.userId;
        const startA = new Date(a.startTime);
        const startB = new Date(b.startTime);
        return startA - startB;
    });

    const sessions = [];
    let currentSession = null;

    sorted.forEach((svc) => {
        const startTime = new Date(svc.startTime);
        // Minimum visual duration of 1 hour for ongoing services
        const minEndTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        const endTime = svc.endTime ? new Date(svc.endTime) : new Date(Math.max(Date.now(), minEndTime.getTime()));

        if (!currentSession || 
            String(svc.userId) !== String(currentSession.userId) || 
            (startTime - currentSession.maxEndTime) > thresholdMinutes * 60000) {
            
            if (currentSession) sessions.push(currentSession);

            currentSession = {
                id: `session-${svc.id}`,
                userId: svc.userId,
                userName: svc.author?.name || 'Employé',
                startTime: startTime,
                maxEndTime: endTime,
                services: [svc],
                totalMinutes: 0
            };
        } else {
            currentSession.services.push(svc);
            if (endTime > currentSession.maxEndTime) {
                currentSession.maxEndTime = endTime;
            }
        }
    });

    if (currentSession) sessions.push(currentSession);

    // Calculer les durées réelles (sans les pauses)
    sessions.forEach(session => {
        session.totalMinutes = session.services.reduce((acc, svc) => {
            const s = new Date(svc.startTime);
            const minE = new Date(s.getTime() + 60 * 60 * 1000);
            const e = svc.endTime ? new Date(svc.endTime) : new Date(Math.max(Date.now(), minE.getTime()));
            return acc + Math.max(0, Math.floor((e - s) / 60000));
        }, 0);
    });

    return sessions;
};
