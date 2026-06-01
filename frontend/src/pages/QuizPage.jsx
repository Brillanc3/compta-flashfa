// frontend/src/pages/QuizPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    GraduationCap, 
    Timer, 
    ChevronRight, 
    ChevronLeft, 
    CheckCircle2, 
    AlertCircle,
    Send,
    XCircle
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import quizService from '@/services/quizService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

const QuizPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [started, setStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const { data: quizData, isLoading, isError, error } = useQuery({
        queryKey: ['quiz', token],
        queryFn: () => quizService.getQuiz(token),
        enabled: started,
        retry: false
    });

    const submitMutation = useMutation({
        mutationFn: () => quizService.submitQuiz(token, answers),
        onSuccess: () => {
            toast.success("Questionnaire envoyé avec succès !");
        },
        onError: (error) => {
            toast.error(error.message || "Erreur lors de l'envoi");
        }
    });

    useEffect(() => {
        if (quizData?.expiresAt) {
            const expiresAt = new Date(quizData.expiresAt).getTime();
            const updateTimer = () => {
                const now = new Date().getTime();
                const diff = expiresAt - now;
                if (diff <= 0) {
                    setTimeLeft(0);
                    if (!submitMutation.isPending && !submitMutation.isSuccess) {
                        submitMutation.mutate();
                    }
                } else {
                    setTimeLeft(diff);
                }
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [quizData, submitMutation]);

    const handleNext = () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setShowConfirm(true);
        }
    };

    const formatTime = (ms) => {
        if (ms === null) return "20:00";
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    if (!started) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-cca-surface border border-cca-border rounded-2xl p-8 shadow-2xl text-center space-y-8 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto text-brand-primary">
                        <GraduationCap size={40} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-white">Questionnaire T.T.E</h1>
                        <p className="text-cca-textSecondary">Évaluation officielle pour la gestion d'entreprise.</p>
                    </div>

                    <div className="bg-cca-base/50 rounded-xl p-6 text-left border border-cca-border space-y-4">
                        <div className="flex items-center gap-3 text-white font-bold">
                            <Timer size={20} className="text-brand-primary" />
                            <span>Consignes importantes</span>
                        </div>
                        <ul className="space-y-3 text-sm text-cca-textSecondary">
                            <li className="flex gap-2"><span>•</span> <span><strong>20 minutes</strong> : Le temps est compté et ne s'arrête jamais.</span></li>
                            <li className="flex gap-2"><span>•</span> <span><strong>20 questions</strong> : Mélange de fiscalité, droit et secteur.</span></li>
                            <li className="flex gap-2"><span>•</span> <span><strong>Validation</strong> : Toute sortie de page entraîne une soumission automatique à la fin du temps.</span></li>
                        </ul>
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs font-bold text-center">
                            ATTENTION : AUCUN RETOUR EN ARRIÈRE POSSIBLE APRÈS SOUMISSION.
                        </div>
                    </div>

                    <button 
                        onClick={() => setStarted(true)}
                        className="w-full bg-brand-primary hover:bg-brand-hover text-white font-black py-4 rounded-xl text-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                    >
                        LANCER L'ÉVALUATION
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) return <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 text-cca-textSecondary"><Spinner size={48} /><span>Initialisation...</span></div>;

    if (isError) return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-cca-surface border border-cca-border rounded-2xl p-8 text-center space-y-6">
                <AlertCircle size={64} className="text-red-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Accès Impossible</h2>
                <p className="text-cca-textSecondary">{error.response?.data?.message || error.message || "Ce lien de questionnaire est invalide ou a expiré."}</p>
                <button onClick={() => navigate('/dashboard')} className="text-brand-primary font-bold hover:underline">Retour au dashboard</button>
            </div>
        </div>
    );

    if (submitMutation.isSuccess) {
        const score = submitMutation.data.score;
        const results = submitMutation.data.results || [];
        
        return (
            <div className="min-h-[80vh] py-12 px-4">
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
                    {/* Summary Card */}
                    <div className="bg-cca-surface border border-cca-border rounded-3xl p-8 md:p-10 text-center space-y-6 shadow-2xl">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-lg ${score >= 15 ? 'bg-green-600 shadow-green-900/20' : 'bg-brand-primary shadow-brand-primary/20'}`}>
                            {score >= 15 ? <CheckCircle2 size={40} /> : <Send size={40} />}
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-white">Questionnaire Terminé !</h2>
                            <p className="text-cca-textSecondary">Vos résultats ont été transmis à l'administration.</p>
                        </div>
                        <div className="py-6 bg-cca-base/50 rounded-2xl border border-cca-border inline-block px-12">
                            <p className="text-xs uppercase tracking-widest text-cca-textSecondary mb-1">Votre Score</p>
                            <div className="text-5xl font-black text-white">
                                {score}<span className="text-xl text-cca-textSecondary ml-2">/ 20</span>
                            </div>
                        </div>
                        <div>
                            <button 
                                onClick={() => navigate('/dashboard')}
                                className="px-8 py-3 bg-cca-base hover:bg-cca-border text-white font-bold rounded-xl border border-cca-border transition-colors"
                            >
                                Retour au Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Detailed Results */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white px-2 flex items-center gap-2">
                            <GraduationCap className="text-brand-primary" />
                            Récapitulatif des réponses
                        </h3>
                        
                        <div className="space-y-4">
                            {results.map((res, idx) => (
                                <div key={idx} className="bg-cca-surface border border-cca-border rounded-2xl overflow-hidden shadow-lg">
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <h4 className="text-lg font-bold text-white leading-snug">
                                                <span className="text-cca-textSecondary mr-2">{idx + 1}.</span>
                                                {res.questionText}
                                            </h4>
                                            {res.isCorrect ? (
                                                <CheckCircle2 size={24} className="text-green-500 flex-shrink-0" />
                                            ) : (
                                                <XCircle size={24} className="text-red-500 flex-shrink-0" />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className={`p-4 rounded-xl border ${res.isCorrect ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                                <p className="text-[10px] uppercase font-bold text-cca-textSecondary mb-1">Votre réponse</p>
                                                <p className={`font-semibold ${res.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                    {res.options[res.userAnswer] || "Pas de réponse"}
                                                </p>
                                            </div>
                                            {!res.isCorrect && (
                                                <div className="p-4 rounded-xl border bg-green-900/10 border-green-500/30">
                                                    <p className="text-[10px] uppercase font-bold text-cca-textSecondary mb-1">Réponse correcte</p>
                                                    <p className="font-semibold text-green-400">
                                                        {res.options[res.correctAnswer]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {res.reference && (
                                            <div className="pt-4 border-t border-cca-border flex items-center gap-2 text-xs text-brand-primary font-bold">
                                                <AlertCircle size={14} />
                                                <span>Source : {res.reference}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentQuestion = quizData.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
            {/* Header / Progress / Timer */}
            <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-cca-textSecondary">Question {currentQuestionIndex + 1} <span className="opacity-50">/ {quizData.questions.length}</span></span>
                        <span className="text-sm font-bold text-brand-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-cca-surface border border-cca-border rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                </div>
                <div className={`
                    px-6 py-3 rounded-2xl border flex items-center gap-3 transition-all duration-300
                    ${timeLeft < 60000 ? 'bg-red-900/20 border-red-500 text-red-500 animate-pulse' : 'bg-cca-surface border-cca-border text-brand-primary'}
                `}>
                    <Timer size={24} />
                    <span className="text-2xl font-black font-mono">{formatTime(timeLeft)}</span>
                </div>
            </div>

            {/* Question Card */}
            <div className="bg-cca-surface border border-cca-border rounded-3xl p-8 md:p-12 shadow-2xl min-h-[450px] flex flex-col animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-10 leading-tight">
                    {currentQuestion.q}
                </h3>

                <div className="space-y-4 flex-1">
                    {currentQuestion.a.map((option, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setAnswers({ ...answers, [currentQuestion.id]: idx })}
                            className={`
                                w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 group
                                ${answers[currentQuestion.id] === idx 
                                    ? 'bg-brand-primary/10 border-brand-primary text-white shadow-lg shadow-brand-primary/5' 
                                    : 'bg-cca-base/30 border-cca-border text-cca-textSecondary hover:bg-cca-base hover:border-cca-textSecondary/30 hover:text-white'}
                            `}
                        >
                            <div className={`
                                w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                ${answers[currentQuestion.id] === idx ? 'border-brand-primary bg-brand-primary' : 'border-cca-border group-hover:border-cca-textSecondary/50'}
                            `}>
                                {answers[currentQuestion.id] === idx && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <span className="text-lg">{option}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-12 flex items-center justify-between">
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-6 py-3 flex items-center gap-2 text-cca-textSecondary hover:text-white transition-colors disabled:opacity-0"
                    >
                        <ChevronLeft size={20} /> Précédent
                    </button>
                    <button 
                        onClick={handleNext}
                        disabled={answers[currentQuestion.id] === undefined}
                        className="px-10 py-4 bg-brand-primary hover:bg-brand-hover text-white font-black rounded-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                    >
                        {currentQuestionIndex === quizData.questions.length - 1 ? 'Terminer' : 'Suivant'}
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Confirm Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="max-w-sm w-full bg-cca-surface border border-cca-border rounded-2xl p-8 shadow-2xl space-y-6">
                        <h4 className="text-xl font-bold text-white">Soumettre le questionnaire ?</h4>
                        <p className="text-sm text-cca-textSecondary">Vous ne pourrez plus modifier vos réponses après cette étape. Confirmez-vous l'envoi ?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-cca-base hover:bg-cca-border rounded-xl text-white font-bold transition-colors">Retour</button>
                            <button onClick={() => submitMutation.mutate()} className="flex-1 py-3 bg-brand-primary hover:bg-brand-hover rounded-xl text-white font-black transition-colors">Confirmer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizPage;
