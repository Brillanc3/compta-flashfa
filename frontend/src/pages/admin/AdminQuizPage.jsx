// frontend/src/pages/admin/AdminQuizPage.jsx
import React, { useState } from 'react';
import { 
    GraduationCap, 
    Send, 
    Search, 
    Clock, 
    User,
    RefreshCcw,
    MoreVertical,
    Trash2,
    Square,
    PlusCircle,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Eye
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContextMenu, ContextMenuItem } from '@/components/ui/ContextMenu';
import Modal from '@/components/Modal';
import quizService from '@/services/quizService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AdminQuizPage = () => {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState(null);
    const [sector, setSector] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [menu, setMenu] = useState({ open: false, x: 0, y: 0, quiz: null });
    const [viewingResults, setViewingResults] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    // Mutations for actions
    const resendMutation = useMutation({
        mutationFn: (id) => quizService.resendQuiz(id),
        onSuccess: () => {
            toast.success("Notification de rappel envoyée");
            setMenu({ ...menu, open: false });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => quizService.deleteQuiz(id),
        onSuccess: () => {
            toast.success("Questionnaire supprimé");
            queryClient.invalidateQueries(['quizzes']);
            setMenu({ ...menu, open: false });
        }
    });

    const extendMutation = useMutation({
        mutationFn: (id) => quizService.extendQuiz(id),
        onSuccess: () => {
            toast.success("Durée prolongée de 10 minutes");
            queryClient.invalidateQueries(['quizzes']);
            setMenu({ ...menu, open: false });
        }
    });

    const terminateMutation = useMutation({
        mutationFn: (id) => quizService.terminateQuiz(id),
        onSuccess: () => {
            toast.success("Quiz terminé de force");
            queryClient.invalidateQueries(['quizzes']);
            setMenu({ ...menu, open: false });
        }
    });

    // Fetch users for the select
    const { data: users, isLoading: loadingUsers } = useQuery({
        queryKey: ['quiz-users'],
        queryFn: quizService.getQuizUsers
    });

    // Fetch existing quizzes
    const { data: quizzes, isLoading: loadingQuizzes } = useQuery({
        queryKey: ['quizzes'],
        queryFn: quizService.listQuizzes
    });

    const sendMutation = useMutation({
        mutationFn: ({ userId, sector }) => quizService.sendQuiz(userId, sector),
        onSuccess: () => {
            toast.success("Questionnaire envoyé avec succès !");
            setSelectedUser(null);
            setSearchTerm('');
            queryClient.invalidateQueries(['quizzes']);
        },
        onError: (error) => {
            toast.error(error.message || "Erreur lors de l'envoi");
        }
    });

    const handleSend = () => {
        if (!selectedUser) {
            toast.error("Veuillez sélectionner un candidat");
            return;
        }
        sendMutation.mutate({ userId: selectedUser.id, sector });
    };

    const filteredUsers = users?.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING': return <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider">En attente</span>;
            case 'STARTED': return <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-400 text-[10px] font-bold uppercase tracking-wider">En cours</span>;
            case 'COMPLETED': return <span className="px-2 py-1 rounded bg-green-900/50 text-green-400 text-[10px] font-bold uppercase tracking-wider">Terminé</span>;
            case 'EXPIRED': return <span className="px-2 py-1 rounded bg-red-900/50 text-red-400 text-[10px] font-bold uppercase tracking-wider">Expiré</span>;
            default: return <span className="px-2 py-1 rounded bg-cca-base text-cca-textSecondary text-[10px] font-bold uppercase tracking-wider">{status}</span>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <GraduationCap className="text-brand-primary" />
                        Gestion des Quiz T.T.E
                    </h1>
                    <p className="text-cca-textSecondary mt-1">
                        Envoyez et suivez les évaluations de connaissances des futurs gérants.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-cca-surface border border-cca-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-primary/10 transition-colors duration-500" />
                        
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Send size={20} className="text-brand-primary" />
                            Nouvel Envoi
                        </h2>

                        <div className="space-y-6">
                            {/* Candidate Selection */}
                            <div>
                                <label className="block text-sm font-medium text-cca-textSecondary mb-2">1. Sélectionner le candidat</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cca-textSecondary" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="Rechercher par nom ou pseudo..."
                                        className="w-full bg-cca-base border border-cca-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-brand-primary outline-none text-white transition-all"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (selectedUser) setSelectedUser(null);
                                        }}
                                    />
                                    {loadingUsers && <Spinner size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {searchTerm && filteredUsers.length > 0 && !selectedUser && (
                                    <div className="mt-2 max-h-48 overflow-y-auto bg-cca-base border border-cca-border rounded-lg divide-y divide-cca-border shadow-2xl z-10 relative">
                                        {filteredUsers.slice(0, 10).map(u => (
                                            <button 
                                                key={u.id}
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-cca-surface text-white transition-colors flex items-center gap-2"
                                                onClick={() => {
                                                    setSelectedUser(u);
                                                    setSearchTerm(`${u.name} (${u.username})`);
                                                }}
                                            >
                                                <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center text-[10px] font-bold">
                                                    {u.name.charAt(0)}
                                                </div>
                                                <span>{u.name} <span className="text-cca-textSecondary text-xs italic">(@{u.username})</span></span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedUser && (
                                    <div className="mt-3 flex items-center justify-between bg-brand-primary/10 border border-brand-primary/30 rounded-lg px-4 py-3 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-3">
                                            <User size={18} className="text-brand-primary" />
                                            <span className="text-sm text-white font-semibold">{selectedUser.name}</span>
                                        </div>
                                        <button 
                                            className="text-cca-textSecondary hover:text-white text-xs underline"
                                            onClick={() => { setSelectedUser(null); setSearchTerm(''); }}
                                        >
                                            Changer
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Sector Selection */}
                            <div>
                                <label className="block text-sm font-medium text-cca-textSecondary mb-2">2. Secteur d'activité</label>
                                <select 
                                    className="w-full bg-cca-base border border-cca-border rounded-lg px-4 py-2.5 text-sm focus:border-brand-primary outline-none text-white transition-all appearance-none cursor-pointer"
                                    value={sector}
                                    onChange={(e) => setSector(parseInt(e.target.value))}
                                >
                                    <option value={1}>Secteur 1 : Alimentation, Pharmacie, Mines...</option>
                                    <option value={2}>Secteur 2 : Garages, Ferme, Pawnshop...</option>
                                    <option value={3}>Secteur 3 : Services, Bars, Restaurants...</option>
                                    <option value={4}>Secteur 4 : Artistes, Médias, Événementiel...</option>
                                </select>
                            </div>

                            <button 
                                onClick={handleSend}
                                disabled={sendMutation.isPending || !selectedUser}
                                className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20"
                            >
                                {sendMutation.isPending ? <Spinner size={20} /> : <Send size={20} />}
                                Envoyer le Questionnaire
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2">
                    <div className="bg-cca-surface border border-cca-border rounded-xl shadow-xl overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-cca-border flex justify-between items-center bg-cca-surface">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Clock size={20} className="text-brand-primary" />
                                Historique & Suivi
                            </h2>
                            <button 
                                onClick={() => queryClient.invalidateQueries(['quizzes'])}
                                className="p-2 rounded-md hover:bg-cca-base text-cca-textSecondary hover:text-white transition-colors"
                                title="Actualiser"
                            >
                                <RefreshCcw size={20} className={loadingQuizzes ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-cca-base border-b border-cca-border">
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary">Candidat</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-center">Secteur</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-center">Statut</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-center">Score</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-right">Date d'envoi</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-cca-textSecondary text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cca-border">
                                    {loadingQuizzes ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-cca-textSecondary">
                                                <Spinner size={32} className="mx-auto block mb-4" />
                                                Chargement des questionnaires...
                                            </td>
                                        </tr>
                                    ) : quizzes?.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-cca-textSecondary italic bg-cca-base/20">
                                                Aucun questionnaire envoyé pour le moment.
                                            </td>
                                        </tr>
                                    ) : (
                                        quizzes?.map((q) => (
                                            <tr key={q.id} className="hover:bg-cca-base/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-cca-base border border-cca-border flex items-center justify-center text-brand-primary font-bold shadow-inner">
                                                            {q.user?.name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-white group-hover:text-brand-primary transition-colors">{q.user?.name}</p>
                                                            <p className="text-[10px] text-cca-textSecondary">@{q.user?.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className="px-2 py-1 rounded bg-cca-base border border-cca-border text-[10px] font-bold text-white">
                                                        Secteur {q.sector}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {getStatusBadge(q.status)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {q.status === 'COMPLETED' ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-lg font-black ${q.score >= 15 ? 'text-green-500' : 'text-orange-500'}`}>
                                                                {q.score} / 20
                                                            </span>
                                                            <span className="text-[8px] uppercase text-cca-textSecondary">Calculé</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-cca-textSecondary font-mono">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <p className="text-xs text-white">{format(new Date(q.createdAt), 'dd MMMM yyyy', { locale: fr })}</p>
                                                    <p className="text-[10px] text-cca-textSecondary">{format(new Date(q.createdAt), 'HH:mm', { locale: fr })}</p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button 
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setMenu({ open: true, x: rect.left, y: rect.bottom, quiz: q });
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-cca-base text-cca-textSecondary hover:text-white transition-all active:scale-90"
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Menu */}
            {menu.open && (
                <ContextMenu 
                    x={menu.x} 
                    y={menu.y} 
                    onClose={() => setMenu({ ...menu, open: false })}
                >
                    <ContextMenuItem 
                        icon={Eye} 
                        onClick={() => {
                            setViewingResults(menu.quiz);
                            setMenu({ ...menu, open: false });
                        }}
                    >
                        Voir les réponses
                    </ContextMenuItem>

                    <ContextMenuItem 
                        icon={RefreshCcw} 
                        onClick={() => resendMutation.mutate(menu.quiz.id)}
                    >
                        Renvoyer notification
                    </ContextMenuItem>
                    
                    {menu.quiz.status === 'STARTED' && (
                        <ContextMenuItem 
                            icon={PlusCircle} 
                            onClick={() => extendMutation.mutate(menu.quiz.id)}
                        >
                            Prolonger (10m)
                        </ContextMenuItem>
                    )}

                    {(menu.quiz.status === 'PENDING' || menu.quiz.status === 'STARTED') && (
                        <ContextMenuItem
                            icon={Square}
                            onClick={() => {
                                const quizId = menu.quiz.id;
                                setMenu(m => ({ ...m, open: false }));
                                setConfirmModal({
                                    isOpen: true,
                                    message: "Voulez-vous vraiment terminer ce quiz de force ? Score = 0.",
                                    onConfirm: () => {
                                        setConfirmModal(p => ({ ...p, isOpen: false }));
                                        terminateMutation.mutate(quizId);
                                    },
                                });
                            }}
                        >
                            Terminer de force
                        </ContextMenuItem>
                    )}

                    <ContextMenuItem
                        icon={Trash2}
                        danger
                        onClick={() => {
                            const quizId = menu.quiz.id;
                            setMenu(m => ({ ...m, open: false }));
                            setConfirmModal({
                                isOpen: true,
                                message: "Supprimer définitivement ce questionnaire ?",
                                onConfirm: () => {
                                    setConfirmModal(p => ({ ...p, isOpen: false }));
                                    deleteMutation.mutate(quizId);
                                },
                            });
                        }}
                    >
                        Supprimer
                    </ContextMenuItem>
                </ContextMenu>
            )}

            {/* Results Modal */}
            <Modal
                isOpen={!!viewingResults}
                onClose={() => setViewingResults(null)}
                title={`Résultats : ${viewingResults?.user?.name}`}
            >
                <div className="space-y-6 max-w-2xl">
                    <div className="bg-cca-base/50 border border-cca-border rounded-xl p-6 flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-cca-textSecondary mb-1">Score Final</p>
                            <p className="text-4xl font-black text-white">
                                {viewingResults?.score} <span className="text-lg text-cca-textSecondary">/ 20</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-cca-textSecondary">Secteur {viewingResults?.sector}</p>
                            <p className="text-xs text-cca-textSecondary">
                                {viewingResults?.completedAt && format(new Date(viewingResults.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {(() => {
                            let answers = [];
                            try {
                                answers = typeof viewingResults?.answers === 'string' 
                                    ? JSON.parse(viewingResults.answers) 
                                    : (viewingResults?.answers || []);
                            } catch (e) {
                                console.error("Error parsing answers:", e);
                            }

                            if (answers.length === 0) {
                                return <p className="text-center py-8 text-cca-textSecondary italic">Aucun détail disponible pour ce quiz.</p>;
                            }

                            return answers.map((res, idx) => {
                                return (
                                    <div key={idx} className="bg-cca-base/30 border border-cca-border rounded-xl p-5 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <h4 className="text-sm font-bold text-white leading-snug">
                                                <span className="text-cca-textSecondary mr-2">{idx + 1}.</span>
                                                {res.questionText || `Question ID: ${res.qId}`}
                                            </h4>
                                            {res.isCorrect ? (
                                                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                                            ) : (
                                                <XCircle size={18} className="text-red-500 flex-shrink-0" />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className={`p-3 rounded-lg border text-xs ${res.isCorrect ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                                <p className="text-[8px] uppercase font-bold text-cca-textSecondary mb-1">Candidat</p>
                                                <p className={`font-semibold ${res.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                    {res.options?.[res.userAnswer] || "N/A"}
                                                </p>
                                            </div>
                                            {!res.isCorrect && (
                                                <div className="p-3 rounded-lg border bg-green-900/10 border-green-500/30 text-xs">
                                                    <p className="text-[8px] uppercase font-bold text-cca-textSecondary mb-1">Correct</p>
                                                    <p className="font-semibold text-green-400">
                                                        {res.options?.[res.correctAnswer] || "N/A"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {res.reference && (
                                            <div className="pt-2 flex items-center gap-2 text-[10px] text-brand-primary font-bold">
                                                <AlertCircle size={12} />
                                                <span>Source : {res.reference}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </Modal>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default AdminQuizPage;
