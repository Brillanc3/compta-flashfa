// backend/src/modules/quiz/quiz.controller.js
const prisma = require('../../db');
const { createNotification } = require('../../services/notificationService');
const questionsData = require('../../data/tte_questions.json');

const QUIZ_DURATION_MS = 20 * 60 * 1000; // 20 minutes

const sendQuiz = async (request, reply) => {
    const { userId, sector } = request.body;
    const adminId = request.user.userId;

    try {
        const session = await prisma.quizSession.create({
            data: {
                userId: parseInt(userId),
                adminId,
                sector: parseInt(sector),
                status: 'PENDING'
            }
        });

        await prisma.notification.create({
            data: {
                type: 'SYSTEM',
                content: JSON.stringify({
                    title: "Nouveau Questionnaire T.T.E",
                    body: `Un administrateur vous a envoyé un questionnaire pour le secteur ${sector}. Vous avez 20 minutes pour y répondre une fois lancé.`,
                    url: `/quiz/${session.token}`
                }),
                recipients: {
                    create: [{ userId: parseInt(userId) }]
                }
            }
        });

        reply.send(session);
    } catch (error) {
        console.error("[QuizController] Error in sendQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de l'envoi du quiz." });
    }
};

const getQuiz = async (request, reply) => {
    const { token } = request.params;
    const userId = request.user.userId;

    try {
        const session = await prisma.quizSession.findUnique({
            where: { token }
        });

        if (!session || session.userId !== userId) {
            return reply.code(403).send({ message: "Session non trouvée ou non autorisée." });
        }

        if (session.status === 'COMPLETED' || session.status === 'EXPIRED') {
            return reply.code(400).send({ message: "Ce questionnaire a déjà été soumis ou a expiré." });
        }

        let startedAt = session.startedAt;
        if (!startedAt) {
            startedAt = new Date();
            await prisma.quizSession.update({
                where: { id: session.id },
                data: { status: 'STARTED', startedAt }
            });
        }

        // Check expiration
        const now = new Date();
        const elapsed = now.getTime() - startedAt.getTime();
        if (elapsed > QUIZ_DURATION_MS + 30000) {
            await prisma.quizSession.update({
                where: { id: session.id },
                data: { status: 'EXPIRED' }
            });
            return reply.code(400).send({ message: "Le temps est écoulé." });
        }

        // Selection des questions
        const general = questionsData.general.sort(() => 0.5 - Math.random()).slice(0, 10);
        const sectorKey = `s${session.sector}`;
        const sectorQuestions = (questionsData[sectorKey] || []).sort(() => 0.5 - Math.random()).slice(0, 10);
        
        // On renvoie les questions SANS les bonnes réponses
        const filteredQuestions = [...general, ...sectorQuestions].map(q => ({
            id: q.id,
            q: q.q,
            a: q.a
        }));

        reply.send({
            session: { ...session, startedAt },
            questions: filteredQuestions,
            expiresAt: new Date(startedAt.getTime() + QUIZ_DURATION_MS)
        });
    } catch (error) {
        console.error("[QuizController] Error in getQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération du quiz." });
    }
};

const submitQuiz = async (request, reply) => {
    const { token } = request.params;
    const { answers } = request.body; // { questionId: answerIndex }
    const userId = request.user.userId;

    try {
        const session = await prisma.quizSession.findUnique({
            where: { token }
        });

        if (!session || session.userId !== userId) {
            return reply.code(403).send({ message: "Session non trouvée ou non autorisée." });
        }

        if (session.status !== 'STARTED') {
            return reply.code(400).send({ message: "Ce questionnaire n'est pas en cours." });
        }

        const now = new Date();
        const elapsed = now.getTime() - session.startedAt.getTime();
        if (elapsed > QUIZ_DURATION_MS + 30000) {
            await prisma.quizSession.update({
                where: { id: session.id },
                data: { status: 'EXPIRED' }
            });
            return reply.code(400).send({ message: "Le temps est écoulé." });
        }

        // Calcul du score
        let score = 0;
        const allQuestions = [...questionsData.general, ...questionsData.s1, ...questionsData.s2, ...questionsData.s3, ...questionsData.s4];
        
        const results = Object.keys(answers).map(qId => {
            const questionId = parseInt(qId);
            const question = allQuestions.find(q => q.id === questionId);
            const isCorrect = question && question.c === answers[qId];
            if (isCorrect) score++;
            return { 
                qId: questionId, 
                isCorrect, 
                userAnswer: answers[qId], 
                correctAnswer: question ? question.c : null,
                questionText: question ? question.q : "Question inconnue",
                options: question ? question.a : [],
                reference: question ? question.ref : ""
            };
        });

        await prisma.quizSession.update({
            where: { id: session.id },
            data: {
                status: 'COMPLETED',
                completedAt: now,
                score,
                answers: JSON.stringify(results)
            }
        });

        reply.send({ score, total: 20, results });
    } catch (error) {
        console.error("[QuizController] Error in submitQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de la soumission du quiz." });
    }
};

const listQuizzes = async (request, reply) => {
    try {
        const quizzes = await prisma.quizSession.findMany({
            include: {
                user: { select: { id: true, name: true, username: true } },
                admin: { select: { id: true, name: true, username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        reply.send(quizzes);
    } catch (error) {
        console.error("[QuizController] Error in listQuizzes:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des quiz." });
    }
};

const getQuizUsers = async (request, reply) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, username: true },
            orderBy: { name: 'asc' }
        });
        reply.send(users);
    } catch (error) {
        console.error("[QuizController] Error in getQuizUsers:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des utilisateurs." });
    }
};

const resendQuiz = async (request, reply) => {
    const { id } = request.params;
    try {
        const session = await prisma.quizSession.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!session) return reply.code(404).send({ message: "Session non trouvée." });

        await prisma.notification.create({
            data: {
                type: 'SYSTEM',
                content: JSON.stringify({
                    title: "Rappel Questionnaire T.T.E",
                    body: `Rappel : Un administrateur vous a envoyé un questionnaire pour le secteur ${session.sector}.`,
                    url: `/quiz/${session.token}`
                }),
                recipients: {
                    create: [{ userId: session.userId }]
                }
            }
        });

        reply.send({ message: "Notification renvoyée." });
    } catch (error) {
        console.error("[QuizController] Error in resendQuiz:", error);
        reply.code(500).send({ message: "Erreur lors du renvoi." });
    }
};

const deleteQuiz = async (request, reply) => {
    const { id } = request.params;
    try {
        await prisma.quizSession.delete({ where: { id: parseInt(id) } });
        reply.send({ message: "Quiz supprimé." });
    } catch (error) {
        console.error("[QuizController] Error in deleteQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de la suppression." });
    }
};

const extendQuiz = async (request, reply) => {
    const { id } = request.params;
    try {
        const session = await prisma.quizSession.findUnique({ where: { id: parseInt(id) } });
        if (!session) return reply.code(404).send({ message: "Session non trouvée." });
        if (session.status !== 'STARTED') return reply.code(400).send({ message: "Le quiz n'est pas en cours." });

        // On rajoute 10 minutes à la date de début (virtuellement) ou on décale
        // En fait, le timer côté front se base sur startedAt.
        // On va juste mettre à jour startedAt pour "tricher" et redonner du temps.
        await prisma.quizSession.update({
            where: { id: parseInt(id) },
            data: { startedAt: new Date(new Date(session.startedAt).getTime() + 10 * 60 * 1000) }
        });

        reply.send({ message: "Durée prolongée de 10 minutes." });
    } catch (error) {
        console.error("[QuizController] Error in extendQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de la prolongation." });
    }
};

const terminateQuiz = async (request, reply) => {
    const { id } = request.params;
    try {
        await prisma.quizSession.update({
            where: { id: parseInt(id) },
            data: { status: 'COMPLETED', completedAt: new Date(), score: 0 }
        });
        reply.send({ message: "Quiz terminé de force." });
    } catch (error) {
        console.error("[QuizController] Error in terminateQuiz:", error);
        reply.code(500).send({ message: "Erreur lors de la terminaison." });
    }
};

module.exports = { sendQuiz, getQuiz, submitQuiz, listQuizzes, getQuizUsers, resendQuiz, deleteQuiz, extendQuiz, terminateQuiz };
