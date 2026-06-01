// /frontend/src/pages/dashboard/RegiePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  Activity, 
  ShieldAlert, 
  Key, 
  Plus, 
  Trash2, 
  Power, 
  Settings,
  Copy,
  ExternalLink,
  Monitor,
  RefreshCw,
  Clock,
  QrCode,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import mpegts from 'mpegts.js';
import { useCompany } from '@/contexts/CompanyContext';
import regieService from '@/services/regieService';
import Spinner from '@/components/ui/Spinner';
import ActionConfirmationModal from '@/components/dashboard/employees/ActionConfirmationModal';

const StreamPlayer = ({ streamKey, label, isEmergency }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;

    const url = `${window.location.protocol}//${window.location.host}/live-flv/live/${streamKey}.flv`;
    console.log('[Regie] Tentative de lecture du flux :', url);

    let player = null;
    let attempts = 0;
    
    const initPlayer = () => {
      attempts++;
      const isSupported = mpegts.isSupported();
      
      console.log('[Regie] Diagnostic init :', { 
        videoRefExists: !!videoRef.current, 
        isSupported: isSupported,
        attempt: attempts 
      });

      if (!videoRef.current) {
        if (attempts < 10) setTimeout(initPlayer, 500);
        return;
      }

      if (!isSupported) {
        console.error('[Regie] Media Source Extensions (MSE) non supportees.');
        setError(true);
        setLoading(false);
        return;
      }
      
      console.log('[Regie] Initialisation du player mpegts...');
      try {
        player = mpegts.createPlayer({
          type: 'flv',
          isLive: true,
          url: url
        }, {
          enableStashBuffer: false,
          liveBufferLatencyChasing: true,
          lazyLoad: false
        });

        player.attachMediaElement(videoRef.current);
        player.load();
        player.play()
          .then(() => {
            console.log('[Regie] Lecture démarrée avec succès');
            setLoading(false);
          })
          .catch(e => {
            console.warn('[Regie] play() en attente de données ou interaction utilisateur :', e.message);
          });

        playerRef.current = player;

        player.on(mpegts.Events.ERROR, (type, detail, info) => {
          console.error('[Regie] Erreur mpegts :', { type, detail, info });
          setError(true);
          setLoading(false);
        });

        player.on(mpegts.Events.STATISTICS_INFO, () => {
          setLoading(false);
        });
      } catch (e) {
        console.error('[Regie] Erreur fatale initialisation player :', e);
        setError(true);
      }
    };

    const timeout = setTimeout(initPlayer, 500);

    return () => {
      clearTimeout(timeout);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamKey]);

  return (
    <div className="relative group aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 transition-all hover:border-indigo-500/50">
      {isEmergency && (
        <div className="absolute inset-0 z-20 bg-rose-600/90 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-pulse">
          <ShieldAlert size={48} className="mb-2" />
          <span className="font-bold tracking-widest text-lg uppercase">FLUX COUPÉ</span>
        </div>
      )}

      {loading && !error && !isEmergency && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/50 text-slate-400">
          <Spinner size="sm" className="mb-2" />
          <span className="text-xs">Attente du flux...</span>
        </div>
      )}

      {error && !isEmergency && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 text-slate-500">
          <Activity size={32} className="mb-2 opacity-50" />
          <span className="text-xs">Aucun signal entrant</span>
        </div>
      )}

      <video 
        ref={videoRef} 
        muted 
        autoPlay 
        className="w-full h-full object-cover"
      />
      
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loading || error ? 'bg-slate-500' : 'bg-green-500 animate-pulse'}`} />
          {label || streamKey}
        </div>
      </div>
    </div>
  );
};

const RegiePage = () => {
  const { activeCompanyId } = useCompany();
  const companyId = Number(activeCompanyId);

  const [serverStatus, setServerStatus] = useState('unknown');
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  useEffect(() => {
    fetchStatus();
    fetchKeys();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchStatus = async () => {
    if (!companyId) return;
    try {
      const data = await regieService.getStatus(companyId);
      setServerStatus(data.status);
    } catch (error) {
      console.error("Status error:", error);
    }
  };

  const fetchKeys = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await regieService.getKeys(companyId);
      setKeys(data);
    } catch {
      toast.error("Erreur lors de la récupération des clés.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartServer = () => {
    setConfirmModal({
      isOpen: true,
      title: "Démarrer le serveur RTMP",
      message: "Voulez-vous lancer le serveur de streaming ? Cela permettra aux streamers de se connecter.",
      variant: 'indigo',
      onConfirm: async () => {
        if (!companyId) return;
        setIsActionLoading(true);
        try {
          await regieService.startServer(companyId);
          setServerStatus('running');
          toast.success("Serveur RTMP démarré avec succès !");
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          toast.error("Impossible de démarrer le serveur.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleStopServer = () => {
    setConfirmModal({
      isOpen: true,
      title: "Arrêter le serveur RTMP",
      message: "Voulez-vous vraiment arrêter le serveur RTMP ? Tous les flux actuels seront immédiatement coupés pour tous les streamers.",
      variant: 'danger',
      onConfirm: async () => {
        if (!companyId) return;
        setIsActionLoading(true);
        try {
          await regieService.stopServer(companyId);
          setServerStatus('stopped');
          toast.success("Serveur RTMP arrêté.");
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          toast.error("Erreur lors de l'arrêt du serveur.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleAddKey = (e) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: "Générer une clé de streaming",
      message: `Voulez-vous générer une nouvelle clé pour "${newKeyLabel}" ?`,
      variant: 'indigo',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          await regieService.generateKey(companyId, {
            label: newKeyLabel,
            expiresAt: newKeyExpiry || null
          });
          toast.success("Clé de streaming générée.");
          setShowAddKeyModal(false);
          setNewKeyLabel('');
          setNewKeyExpiry('');
          fetchKeys();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          toast.error("Erreur lors de la génération de la clé.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleDeleteKey = (keyId) => {
    setConfirmModal({
      isOpen: true,
      title: "Supprimer la clé",
      message: "Voulez-vous vraiment supprimer cette clé ? Le streamer ne pourra plus se connecter et tout flux actif utilisant cette clé sera coupé.",
      variant: 'danger',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          await regieService.deleteKey(companyId, keyId);
          toast.success("Clé supprimée.");
          fetchKeys();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          toast.error("Erreur lors de la suppression.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleToggleEmergency = async (keyId, currentStatus) => {
    try {
      await regieService.toggleEmergency(companyId, keyId, !currentStatus);
      toast.success(!currentStatus ? "COUPURE D'URGENCE ACTIVÉE" : "Flux rétabli");
      fetchKeys();
    } catch {
      toast.error("Erreur commande d'urgence.");
    }
  };

  const copyToClipboard = (text, msg) => {
    navigator.clipboard.writeText(text);
    toast.success(msg || "Copié dans le presse-papiers");
  };

  const rtmpUrl = `rtmp://${window.location.hostname}/live`;

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Main Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <Tv className="text-indigo-500" size={32} />
             Régie de Diffusion
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Contrôle des flux en direct et gestion des streamers.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
             serverStatus === 'running' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-500'
           }`}>
              <div className={`w-2 h-2 rounded-full ${serverStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
              {serverStatus === 'running' ? 'SERVEUR EN LIGNE' : 'SERVEUR HORS LIGNE'}
           </div>
           
           {serverStatus === 'running' ? (
             <button
               onClick={handleStopServer}
               disabled={isActionLoading}
               className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-lg shadow-rose-600/20 active:scale-95 text-xs font-bold"
             >
               <Power size={16} />
               ARRETER
             </button>
           ) : (
             <button
               onClick={handleStartServer}
               disabled={isActionLoading}
               className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-xs font-bold"
             >
               <Power size={16} />
               DEMARRER
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Multiview */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Monitor size={18} className="text-indigo-400" />
                Multiview (Previews)
              </h2>
              <div className="text-[10px] text-slate-500 uppercase font-mono">
                 {keys.length} canaux configurés
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {keys.length > 0 ? (
                keys.map(k => (
                  <StreamPlayer 
                    key={k.id}
                    streamKey={k.key}
                    label={k.label}
                    isEmergency={k.isEmergency}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                   <Tv size={48} className="text-slate-700 mb-4" />
                   <p className="text-slate-500 text-sm italic">Aucune clé de streaming configurée.</p>
                   <button 
                     onClick={() => setShowAddKeyModal(true)}
                     className="mt-4 text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1"
                   >
                     <Plus size={14} /> Créer ma première clé
                   </button>
                </div>
              )}
           </div>
        </div>

        {/* Right Column: Manage Keys & OBS Links */}
        <div className="space-y-6">
           {/* Section 1: Connection Infos */}
           <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <Settings size={16} className="text-indigo-400" />
                 Infos Serveur RTMP
              </h3>
              
              <div className="space-y-3">
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">URL RTMP (Serveur)</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                       <code className="text-[10px] text-indigo-300 truncate flex-1">{rtmpUrl}</code>
                       <button onClick={() => copyToClipboard(rtmpUrl, "URL RTMP copiée")} className="text-slate-500 hover:text-white transition-colors">
                          <Copy size={14} />
                       </button>
                    </div>
                 </div>
                 <p className="text-[10px] text-slate-500 italic">
                    Utilisez cette URL dans OBS (Paramètres {'>'} Flux {'>'} Serveur personnalisé). La clé de streaming est générée ci-dessous.
                 </p>
              </div>
           </div>

           {/* Section 2: Keys Management */}
           <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                   <Key size={16} className="text-indigo-400" />
                   Gestion des Clés
                </h3>
                <button 
                  onClick={() => setShowAddKeyModal(true)}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                 {loading ? (
                   <div className="p-10 flex justify-center"><Spinner size="sm" /></div>
                 ) : keys.map(k => (
                   <div key={k.id} className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className={`text-xs font-bold ${k.isEmergency ? 'text-rose-500' : 'text-slate-200'}`}>
                               {k.label || 'Sans label'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">Clé: ****{k.key.slice(-4)}</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleToggleEmergency(k.id, k.isEmergency)}
                              className={`p-2 rounded-lg transition-all ${
                                k.isEmergency ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:bg-rose-500/20 hover:text-rose-500'
                              }`}
                              title={k.isEmergency ? "Rétablir le flux" : "COUPE D'URGENCE (Bascule sur l'image temporaire)"}
                            >
                               <ShieldAlert size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteKey(k.id)}
                              className="p-2 text-slate-500 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg transition-all"
                              title="Supprimer la clé"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                         <button 
                           onClick={() => copyToClipboard(k.key, "Clé de streaming copiée")}
                           className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-[10px]"
                         >
                            <Key size={12} /> Copier Clé
                         </button>
                         <button 
                           onClick={() => copyToClipboard(`${window.location.origin}/stream-source/${k.key}`, "Lien OBS copié")}
                           className="flex items-center justify-center gap-1.5 py-1.5 bg-indigo-950/20 border border-indigo-500/30 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all text-[10px]"
                         >
                            <ExternalLink size={12} /> Lien OBS
                         </button>
                      </div>
                   </div>
                 ))}
                 {!loading && keys.length === 0 && (
                   <div className="p-8 text-center text-[10px] text-slate-500 italic uppercase tracking-wider">
                      Aucune clé active
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Add Key Modal */}
      {showAddKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              <form onSubmit={handleAddKey}>
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Plus className="text-indigo-400" size={24} />
                      Nouvelle Clé
                   </h2>
                </div>

                <div className="p-6 space-y-4">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Label (Nom de l'employé ou canal)</label>
                      <input 
                        required
                        type="text" 
                        value={newKeyLabel}
                        onChange={e => setNewKeyLabel(e.target.value)}
                        placeholder="Ex: John Doe - Stream"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Date d'expiration (Optionnel)</label>
                      <input 
                        type="datetime-local" 
                        value={newKeyExpiry}
                        onChange={e => setNewKeyExpiry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                      />
                      <p className="text-[10px] text-slate-500 italic">Laissez vide pour une clé permanente.</p>
                   </div>
                </div>

                <div className="p-6 bg-slate-950/50 flex gap-3">
                   <button 
                     type="button"
                     onClick={() => setShowAddKeyModal(false)}
                     className="flex-1 py-3 text-slate-400 hover:text-white font-bold transition-all"
                   >
                     Annuler
                   </button>
                   <button 
                     type="submit"
                     disabled={isActionLoading}
                     className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:bg-slate-800"
                   >
                      {isActionLoading ? <Spinner size="sm" /> : 'Générer'}
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}
      
      <ActionConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        loading={isActionLoading}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
};

export default RegiePage;
