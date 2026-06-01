// frontend/src/services/quizService.js
import { api } from './api';

const quizService = {
    sendQuiz: async (userId, sector) => {
        const response = await api.post('/quiz/send', { userId, sector });
        return response.data;
    },
    getQuiz: async (token) => {
        const response = await api.get(`/quiz/${token}`);
        return response.data;
    },
    submitQuiz: async (token, answers) => {
        const response = await api.post(`/quiz/${token}/submit`, { answers });
        return response.data;
    },
    listQuizzes: async () => {
        const response = await api.get('/quiz');
        return response.data;
    },
    getQuizUsers: async () => {
        const response = await api.get('/quiz/users');
        return response.data;
    },
    resendQuiz: async (id) => {
        const response = await api.post(`/quiz/${id}/resend`);
        return response.data;
    },
    deleteQuiz: async (id) => {
        const response = await api.delete(`/quiz/${id}`);
        return response.data;
    },
    extendQuiz: async (id) => {
        const response = await api.patch(`/quiz/${id}/extend`);
        return response.data;
    },
    terminateQuiz: async (id) => {
        const response = await api.patch(`/quiz/${id}/terminate`);
        return response.data;
    }
};

export default quizService;
