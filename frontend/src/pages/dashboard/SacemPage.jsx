// frontend/src/pages/dashboard/SacemPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Plus, 
  Search, 
  Filter, 
  MessageSquare, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  X,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  History,
  Info
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useCompany } from '@/contexts/CompanyContext';
import sacemService from '@/services/sacemService';
import { getCompanyEmployees } from '@/services/employeesService';
import Spinner from '@/components/ui/Spinner';

const SacemPage = () => {
  const { activeCompanyId } = useCompany();
  const companyId = Number(activeCompanyId);

  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [_employeesLoading, setEmployeesLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Filters
  const [page, _setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [dateRange, setDateRange] = useState('1month');

  // Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState('PASTE'); // 'PASTE', 'PREVIEW'
  const [importText, setImportText] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  // Expansion State (Editing)
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingParticipations, setEditingParticipations] = useState([]);
  const [editingCategory, setEditingCategory] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);

  // Expansion State (History)
  const [expandedPaymentsPostId, setExpandedPaymentsPostId] = useState(null);
  const [postDetails, setPostDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchPosts();
    fetchStats();
    fetchEmployees();
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page, category, dateRange]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await sacemService.getPosts({
        page,
        limit: 20,
        category,
        search
      });
      setPosts(data.items);
      setTotalPosts(data.total);
    } catch (_error) {
      toast.error("Erreur lors du chargement des posts.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      let from = null, to = null;
      if (dateRange !== 'all') {
        to = new Date();
        if (dateRange === '1month') from = subMonths(new Date(), 1);
        else if (dateRange === '2weeks') from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        else if (dateRange === '1week') from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const data = await sacemService.getStats(
        from ? from.toISOString() : null, 
        to ? to.toISOString() : null
      );
      setStats(data);
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const data = await getCompanyEmployees(companyId, { status: 'ACTIVE' });
      setEmployees(data);
    } catch (error) {
      console.error("Erreur employes:", error);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await sacemService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Erreur categories:", error);
    }
  };

  const handleStartPreview = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    try {
      const data = await sacemService.previewImport(importText);
      const enriched = data.map(entry => ({
        ...entry,
        title: entry.isNew ? `Post ${entry.messageId.slice(-4)}` : entry.existingPost.title,
        category: entry.isNew ? '' : entry.existingPost.category,
        participations: entry.isNew ? [] : entry.existingPost.participations,
        postId: entry.isNew ? null : entry.existingPost.id
      }));
      setPreviewData(enriched);
      setImportStep('PREVIEW');
    } catch (error) {
      toast.error(error.response?.data?.message || "Erreur lors de l'analyse.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFinalImport = async () => {
    setIsImporting(true);
    try {
      const result = await sacemService.importData(previewData);
      toast.success(`Import réussi : ${result.created} créés, ${result.paymentsAdded} paiements ajoutés.`);
      setImportText('');
      setPreviewData([]);
      setIsImportModalOpen(false);
      setImportStep('PASTE');
      fetchPosts();
      fetchStats();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Erreur lors de l'import.");
    } finally {
      setIsImporting(false);
    }
  };

  const updatePreviewEntry = (index, updates) => {
    const newData = [...previewData];
    newData[index] = { ...newData[index], ...updates };
    setPreviewData(newData);
  };

  const startEditingPost = (post) => {
    setExpandedPaymentsPostId(null);
    setExpandedPostId(post.id);
    setEditingTitle(post.title || '');
    setEditingParticipations(post.participations.map(p => ({
      employeeId: p.employeeId,
      percentage: p.percentage
    })));
    setEditingCategory(post.category || '');
    setIsNewCategory(false);
  };

  const togglePaymentHistory = async (postId) => {
    if (expandedPaymentsPostId === postId) {
      setExpandedPaymentsPostId(null);
      setPostDetails(null);
      return;
    }
    setExpandedPostId(null);
    setExpandedPaymentsPostId(postId);
    setDetailsLoading(true);
    try {
      const data = await sacemService.getPost(postId);
      setPostDetails(data);
    } catch (_error) {
      toast.error("Erreur lors du chargement de l'historique.");
      setExpandedPaymentsPostId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const addParticipationRow = (index = null) => {
    if (index !== null) {
      const newData = [...previewData];
      newData[index].participations = [...(newData[index].participations || []), { employeeId: '', percentage: 0 }];
      setPreviewData(newData);
    } else {
      setEditingParticipations([...editingParticipations, { employeeId: '', percentage: 0 }]);
    }
  };

  const removeParticipationRow = (index, partIdx) => {
    const newData = [...previewData];
    newData[index].participations = newData[index].participations.filter((_, i) => i !== partIdx);
    setPreviewData(newData);
  };

  const handleSavePost = async (post) => {
    try {
      await sacemService.updatePost(post.id, {
        title: editingTitle,
        category: editingCategory,
        participations: editingParticipations.filter(p => p.employeeId && p.percentage > 0)
      });
      toast.success("Post mis à jour.");
      setExpandedPostId(null);
      fetchPosts();
      fetchStats();
      fetchCategories();
    } catch (_error) {
      toast.error("Erreur lors de la sauvegarde.");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Module SACEM</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Gestion des droits d'auteur et redistribution des revenus Discord.</p>
        </div>
        <button
          onClick={() => {
            setImportStep('PASTE');
            setIsImportModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-sm font-semibold"
        >
          <Plus size={18} />
          Importer des données
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Revenus" 
          value={`${stats?.totalEarnings?.toLocaleString() || 0} $`} 
          icon={DollarSign} 
          color="green" 
          subValue={dateRange === 'all' ? 'Tout le temps' : 'Période sélectionnée'}
        />
        <StatCard 
          label="Posts Actifs" 
          value={totalPosts} 
          icon={MessageSquare} 
          color="indigo" 
          subValue="Tous les posts"
        />
        <StatCard 
          label="Top Catégorie" 
          value={stats?.statsByCategory?.[0]?.name || 'N/A'} 
          icon={TrendingUp} 
          color="amber" 
          subValue={stats?.statsByCategory?.[0]?.value ? `${stats.statsByCategory[0].value.toLocaleString()} $` : ''}
        />
        <StatCard 
          label="Tendance" 
          value={stats?.trend !== undefined ? `${stats.trend > 0 ? '+' : ''}${stats.trend}%` : '...'} 
          icon={stats?.trend >= 0 ? ArrowUpRight : ArrowDownRight} 
          color={stats?.trend >= 0 ? "green" : "rose"} 
          subValue={dateRange === 'all' ? 'Comparaison indisponible' : 'vs période précédente'}
        />
      </div>

      {/* Filters & Table */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
        <div className="p-4 border-b border-slate-700/50 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Rechercher par titre ou ID message..."
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-1 md:flex-none">
                <Tag size={18} className="text-slate-500 hidden sm:block" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-200 focus:outline-none text-sm"
                >
                  <option value="">Toutes catégories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 md:flex-none">
                <Calendar size={18} className="text-slate-500 hidden sm:block" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-200 focus:outline-none text-sm"
                >
                  <option value="all">Voir tout</option>
                  <option value="1month">Dernier mois</option>
                  <option value="2weeks">2 dernières semaines</option>
                  <option value="1week">Dernière semaine</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="w-full text-left border-collapse hidden lg:table">
                <thead>
                  <tr className="bg-slate-950/30 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Titre / ID Message</th>
                    <th className="px-6 py-4 font-semibold">Posté le</th>
                    <th className="px-6 py-4 font-semibold">Catégorie</th>
                    <th className="px-6 py-4 font-semibold">Total Revenus</th>
                    <th className="px-6 py-4 font-semibold">Participations</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {posts.length > 0 ? (
                    posts.map((post) => (
                      <React.Fragment key={post.id}>
                        <PostRow 
                          post={post} 
                          isEditing={expandedPostId === post.id}
                          isHistory={expandedPaymentsPostId === post.id}
                          onEdit={() => startEditingPost(post)}
                          onHistory={() => togglePaymentHistory(post.id)}
                        />
                        {/* Expansion Logic inside PostRow/Fragment */}
                        {expandedPostId === post.id && (
                          <PostEditor 
                            post={post} 
                            editingTitle={editingTitle} 
                            setEditingTitle={setEditingTitle}
                            editingCategory={editingCategory}
                            setEditingCategory={setEditingCategory}
                            editingParticipations={editingParticipations}
                            setEditingParticipations={setEditingParticipations}
                            employees={employees}
                            categories={categories}
                            isNewCategory={isNewCategory}
                            setIsNewCategory={setIsNewCategory}
                            onSave={() => handleSavePost(post)}
                            onCancel={() => setExpandedPostId(null)}
                            addParticipationRow={addParticipationRow}
                          />
                        )}
                        {expandedPaymentsPostId === post.id && (
                          <PaymentHistory 
                            post={post} 
                            postDetails={postDetails} 
                            detailsLoading={detailsLoading} 
                          />
                        )}
                      </React.Fragment>
                    ))
                  ) : null}
                </tbody>
              </table>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden divide-y divide-slate-800/50">
                 {posts.length > 0 ? (
                    posts.map((post) => (
                      <div key={post.id} className="p-4 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                           <div className="flex flex-col">
                              <span className="text-slate-200 font-semibold">{post.title}</span>
                              <span className="text-[10px] text-slate-500 font-mono">#{post.messageId}</span>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                                  {post.category || 'Sans catégorie'}
                                </span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Calendar size={10} />
                                  {format(new Date(post.postedAt), 'Pp', { locale: fr })}
                                </span>
                              </div>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-green-400 font-bold font-mono">{post.totalEarnings.toLocaleString()} $</span>
                              <div className="flex -space-x-1.5 mt-2">
                                {post.participations.slice(0, 3).map((p, i) => (
                                  <div key={i} className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[8px] text-white font-bold" title={p.employee.user.name}>
                                    {p.employee.user.name.charAt(0)}
                                  </div>
                                ))}
                                {post.participations.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[8px] text-white font-bold">
                                    +{post.participations.length - 3}
                                  </div>
                                )}
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2">
                          <button 
                            onClick={() => togglePaymentHistory(post.id)}
                            className={`flex flex-1 items-center justify-center gap-2 py-2 rounded-xl text-xs transition-colors ${expandedPaymentsPostId === post.id ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-750'}`}
                          >
                            <DollarSign size={14} />
                            Historique
                          </button>
                          <button 
                            onClick={() => startEditingPost(post)}
                            className={`flex flex-1 items-center justify-center gap-2 py-2 rounded-xl text-xs transition-colors ${expandedPostId === post.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-750'}`}
                          >
                            <Edit2 size={14} />
                            Éditer
                          </button>
                        </div>

                        {/* Card Expansions */}
                        {expandedPostId === post.id && (
                          <div className="p-4 bg-slate-950/40 rounded-xl border border-indigo-500/30">
                            <PostEditor 
                              post={post} 
                              editingTitle={editingTitle} 
                              setEditingTitle={setEditingTitle}
                              editingCategory={editingCategory}
                              setEditingCategory={setEditingCategory}
                              editingParticipations={editingParticipations}
                              setEditingParticipations={setEditingParticipations}
                              employees={employees}
                              categories={categories}
                              isNewCategory={isNewCategory}
                              setIsNewCategory={setIsNewCategory}
                              onSave={() => handleSavePost(post)}
                              onCancel={() => setExpandedPostId(null)}
                              addParticipationRow={addParticipationRow}
                              isMobile={true}
                            />
                          </div>
                        )}
                        {expandedPaymentsPostId === post.id && (
                          <div className="p-4 bg-slate-950/40 rounded-xl border border-green-500/30">
                            <PaymentHistory 
                              post={post} 
                              postDetails={postDetails} 
                              detailsLoading={detailsLoading} 
                              isMobile={true}
                            />
                          </div>
                        )}
                      </div>
                    ))
                 ) : null}
              </div>

              {posts.length === 0 && (
                <div className="px-6 py-20 text-center text-slate-500 italic text-sm">
                  Aucun post trouvé.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Import Modal / Wizard */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-slate-900 md:border md:border-slate-700 w-full max-w-5xl md:rounded-2xl shadow-2xl h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
               <div className="flex items-center gap-3">
                 <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                   <Plus className="text-indigo-400" size={20} />
                   Importation SACEM
                 </h2>
                 <div className="hidden sm:flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-indigo-600 text-white">
                     {importStep === 'PASTE' ? '1' : <CheckCircle2 size={12} />}
                   </div>
                   <div className="w-6 h-[1px] bg-slate-800" />
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${importStep === 'PREVIEW' ? 'bg-indigo-600' : 'bg-slate-800'} text-white`}>
                     2
                   </div>
                 </div>
               </div>
               <button onClick={() => setIsImportModalOpen(false)} className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg transition-colors">
                 <X size={20} />
               </button>
            </div>

            <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              {importStep === 'PASTE' ? (
                <div className="space-y-4">
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    Copiez et collez ici le texte exporté depuis Discord (le format doit contenir "Id du Message", "Posté le", "Paie par réaction", etc.)
                  </p>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full h-[60vh] md:h-80 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 font-mono text-[10px] md:text-xs focus:outline-none focus:border-indigo-500 transition-colors resize-none shadow-inner"
                    placeholder="Réception du paiement\nDate: 23h15m32 25/02/2026\n\nId du Message : 1476341032919765061..."
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs md:text-sm text-slate-400">
                      Vérifiez les données extraites et configurez les <span className="text-indigo-400 font-bold">nouveaux posts</span>.
                    </p>
                    <div className="flex gap-4 text-[10px]">
                       <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Nouveau</span>
                       <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-600" /> Existant</span>
                    </div>
                  </div>

                  {/* Desktop Preview Table */}
                  <div className="hidden md:block overflow-hidden border border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                          <th className="px-4 py-3">Statut</th>
                          <th className="px-4 py-3">Titre / Catégorie</th>
                          <th className="px-4 py-3">Montant</th>
                          <th className="px-4 py-3">Participations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 bg-slate-950/20">
                        {previewData.map((entry, idx) => (
                          <PreviewRow 
                            key={idx} 
                            entry={entry} 
                            idx={idx} 
                            employees={employees}
                            categories={categories}
                            updatePreviewEntry={updatePreviewEntry}
                            removeParticipationRow={removeParticipationRow}
                            addParticipationRow={addParticipationRow}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Preview List */}
                  <div className="md:hidden space-y-4 pb-4">
                    {previewData.map((entry, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${entry.isNew ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-slate-800/20 border-slate-700/50'} space-y-4`}>
                        <div className="flex justify-between items-center">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.isNew ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                             {entry.isNew ? 'NOUVEAU' : 'EXISTANT'}
                           </span>
                           <span className="text-green-400 font-mono font-bold">{entry.amount.toLocaleString()} $</span>
                        </div>
                        
                        {entry.isNew ? (
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:border-indigo-500"
                              placeholder="Titre du post"
                              value={entry.title}
                              onChange={(e) => updatePreviewEntry(idx, { title: e.target.value })}
                            />
                            <select
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs"
                              value={entry.category}
                              onChange={(e) => updatePreviewEntry(idx, { category: e.target.value })}
                            >
                              <option value="">Catégorie (optionnel)</option>
                              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            
                            <div className="pt-2 border-t border-slate-800/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Participations</span>
                                <button 
                                  onClick={() => addParticipationRow(idx)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  <Plus size={10} /> Ajouter
                                </button>
                              </div>
                              {entry.participations.map((part, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2">
                                  <select
                                    className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300 flex-1"
                                    value={part.employeeId}
                                    onChange={(e) => {
                                      const newParts = [...entry.participations];
                                      newParts[pIdx].employeeId = e.target.value;
                                      updatePreviewEntry(idx, { participations: newParts });
                                    }}
                                  >
                                    <option value="">Employé</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.user.name}</option>)}
                                  </select>
                                  <div className="relative w-14">
                                    <input 
                                      type="number" 
                                      className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] pr-4"
                                      value={part.percentage}
                                      onChange={(e) => {
                                        const newParts = [...entry.participations];
                                        newParts[pIdx].percentage = e.target.value;
                                        updatePreviewEntry(idx, { participations: newParts });
                                      }}
                                    />
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-slate-600">%</span>
                                  </div>
                                  <button onClick={() => removeParticipationRow(idx, pIdx)} className="text-red-500/50 p-1"><X size={14} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-slate-300 font-medium">{entry.title}</div>
                            <div className="text-[10px] text-slate-600 italic">{entry.category || 'Aucune catégorie'}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {entry.participations.map((p, pi) => (
                                 <span key={pi} className="px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded text-[8px]">{p.employeeName} ({p.percentage}%)</span>
                               ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl flex flex-col sm:flex-row gap-4 justify-between items-center">
               <div className="text-[10px] md:text-xs text-slate-500 w-full sm:w-auto">
                  {importStep === 'PREVIEW' && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>Nouveaux : <b className="text-indigo-400">{previewData.filter(d => d.isNew).length}</b></span>
                      <span>Mises à jour : <b className="text-slate-300">{previewData.filter(d => !d.isNew).length}</b></span>
                      <span className="ml-auto sm:ml-0 font-bold text-white">${previewData.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
                    </div>
                  )}
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                 <button 
                   onClick={() => {
                     if (importStep === 'PREVIEW') setImportStep('PASTE');
                     else setIsImportModalOpen(false);
                   }}
                   className="flex-1 sm:flex-none px-4 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                 >
                   {importStep === 'PREVIEW' ? 'Retour' : 'Annuler'}
                 </button>
                 <button 
                   onClick={importStep === 'PASTE' ? handleStartPreview : handleFinalImport}
                   disabled={isImporting || (importStep === 'PASTE' && !importText.trim())}
                   className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold transition-all ${isImporting || (importStep === 'PASTE' && !importText.trim()) ? 'bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}
                 >
                   {isImporting ? (
                     <Spinner size="sm" />
                   ) : (
                     <>
                       {importStep === 'PASTE' ? (
                         <>Analyse <ChevronRight size={18} /></>
                       ) : (
                         <><CheckCircle2 size={18} /> Importer</>
                       )}
                     </>
                   )}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Sub Components --- */

const PostRow = ({ post, isEditing, isHistory, onEdit, onHistory }) => (
  <tr className={`hover:bg-slate-800/30 transition-colors group ${isEditing || isHistory ? 'bg-indigo-500/10' : ''}`}>
    <td className="px-6 py-4 font-medium text-slate-200">
      <div className="flex flex-col">
        <span>{post.title}</span>
        <span className="text-xs text-slate-500 font-mono">#{post.messageId}</span>
      </div>
    </td>
    <td className="px-6 py-4 text-slate-400 text-sm">
      {format(new Date(post.postedAt), 'Pp', { locale: fr })}
    </td>
    <td className="px-6 py-4">
      <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
        {post.category || 'Non classé'}
      </span>
    </td>
    <td className="px-6 py-4 font-mono text-green-400">
      {post.totalEarnings.toLocaleString()} $
    </td>
    <td className="px-6 py-4">
      <div className="flex -space-x-2">
         {post.participations.slice(0, 3).map((p, i) => (
           <div key={i} className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-bold" title={p.employee.user.name}>
             {p.employee.user.name.charAt(0)}
           </div>
         ))}
         {post.participations.length > 3 && (
           <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-bold">
             +{post.participations.length - 3}
           </div>
         )}
         {post.participations.length === 0 && (
           <span className="text-xs text-slate-600 italic">Aucune</span>
         )}
      </div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="flex justify-end items-center gap-1">
        <button 
          onClick={onHistory}
          className={`p-2 rounded-lg transition-colors ${isHistory ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-green-500/20 hover:text-green-400'}`}
          title="Historique des paiements"
        >
          <DollarSign size={16} />
        </button>
        <button 
          onClick={onEdit}
          className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-400'}`}
        >
          <Edit2 size={16} />
        </button>
      </div>
    </td>
  </tr>
);

const PostEditor = ({
  post: _post, editingTitle, setEditingTitle, editingCategory, setEditingCategory,
  editingParticipations, setEditingParticipations, employees, categories, 
  isNewCategory, setIsNewCategory, onSave, onCancel, addParticipationRow, isMobile 
}) => {
  const content = (
    <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-2'} gap-8`}>
      {/* Participations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            Gestion des participations
          </h3>
          <button 
           onClick={() => addParticipationRow()}
           className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Ajouter
          </button>
        </div>

        <div className="space-y-2">
          {editingParticipations.map((edit, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <select
                value={edit.employeeId}
                onChange={(e) => {
                  const newEdits = [...editingParticipations];
                  newEdits[idx].employeeId = e.target.value;
                  setEditingParticipations(newEdits);
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 md:px-3 py-1.5 text-xs md:text-sm text-slate-200"
              >
                <option value="">Employé...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.user.name}</option>
                ))}
              </select>
              <div className="relative w-20 md:w-24">
                <input
                  type="number"
                  value={edit.percentage}
                  onChange={(e) => {
                    const newEdits = [...editingParticipations];
                    newEdits[idx].percentage = e.target.value;
                    setEditingParticipations(newEdits);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 md:px-3 py-1.5 text-xs md:text-sm text-slate-200 pr-5"
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">%</span>
              </div>
              <button 
               onClick={() => setEditingParticipations(editingParticipations.filter((_, i) => i !== idx))}
               className="p-1.5 text-slate-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {editingParticipations.length === 0 && (
            <div className="text-center py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
              Aucun employé configuré
            </div>
          )}
        </div>
      </div>

      {/* Post Settings Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Tag size={16} className="text-indigo-400" />
          Configuration du post
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] md:text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Titre du post</label>
            <input 
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs md:text-sm text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Nom du post..."
            />
          </div>
          <div>
            <label className="block text-[10px] md:text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Catégorie</label>
            <div className="flex gap-2">
              {!isNewCategory ? (
                <select
                   value={editingCategory}
                   onChange={(e) => {
                     if (e.target.value === '___NEW___') setIsNewCategory(true);
                     else setEditingCategory(e.target.value);
                   }}
                   className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs md:text-sm text-slate-200"
                >
                  <option value="">Sans catégorie</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="___NEW___">+ Créer une catégorie</option>
                </select>
              ) : (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingCategory}
                    onChange={(e) => setEditingCategory(e.target.value)}
                    placeholder="Nouvelle..."
                    className="flex-1 bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs md:text-sm text-slate-200 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => setIsNewCategory(false)} className="px-2 text-slate-500"><X size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${isMobile ? '' : 'lg:col-span-2'} flex flex-col sm:flex-row items-center gap-3 mt-4 pt-4 border-t border-slate-800`}>
        <button 
          onClick={onSave}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-600/20"
        >
          <Save size={16} />
          Sauvegarder
        </button>
        <button 
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );

  return isMobile ? content : (
    <td colSpan={6} className="bg-slate-950/40 px-6 py-6 border-t border-indigo-500/30">
      {content}
    </td>
  );
};

const PaymentHistory = ({ post, postDetails, detailsLoading, isMobile }) => {
  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
         <h3 className="text-sm font-semibold text-white flex items-center gap-2">
           <History size={16} className="text-green-400" />
           Historique
         </h3>
         <div className="text-[10px] md:text-xs text-slate-500 flex items-center gap-2">
            <Info size={14} />
            {post.totalEarnings.toLocaleString()} $ total
         </div>
      </div>

      {detailsLoading ? (
         <div className="flex justify-center py-6"><Spinner size="sm" /></div>
      ) : (
         <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-[10px] md:text-xs">
               <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-bold">
                  <tr>
                     <th className="px-4 py-2">Date</th>
                     <th className="px-4 py-2 text-right hidden sm:table-cell">Réactions</th>
                     <th className="px-4 py-2 text-right">Montant</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {postDetails?.payments?.map((payment, pIdx) => (
                     <tr key={pIdx} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 text-slate-300">
                          {format(new Date(payment.receivedAt), 'Pp', { locale: fr })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">
                          {payment.reactionsCount}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 font-mono font-bold">
                          {Number(payment.amount).toLocaleString()} $
                        </td>
                     </tr>
                  ))}
                  {(!postDetails?.payments || postDetails.payments.length === 0) && (
                     <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-600 italic">Aucun paiement.</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      )}
    </div>
  );

  return isMobile ? content : (
    <td colSpan={6} className="bg-slate-950/40 px-6 py-6 border-t border-green-500/30">
      {content}
    </td>
  );
};

const PreviewRow = ({ entry, idx, employees, categories, updatePreviewEntry, removeParticipationRow, addParticipationRow }) => (
  <tr className={`${entry.isNew ? 'bg-indigo-500/5' : ''}`}>
    <td className="px-4 py-4 w-20">
      {entry.isNew ? (
        <span className="flex items-center gap-1 text-indigo-400 font-bold">
          <Plus size={14} /> NEW
        </span>
      ) : (
        <span className="text-slate-600 font-medium font-mono">EXIST</span>
      )}
    </td>
    <td className="px-4 py-4">
      {entry.isNew ? (
        <div className="space-y-2 max-w-xs">
          <input 
            type="text" 
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:border-indigo-500"
            placeholder="Titre du post"
            value={entry.title}
            onChange={(e) => updatePreviewEntry(idx, { title: e.target.value })}
          />
          <select
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs"
            value={entry.category}
            onChange={(e) => updatePreviewEntry(idx, { category: e.target.value })}
          >
            <option value="">Catégorie (optionnel)</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="text-slate-300 font-medium">{entry.title}</span>
          <span className="text-[10px] text-slate-600">{entry.category || 'Aucune catégorie'}</span>
        </div>
      )}
    </td>
    <td className="px-4 py-4 font-mono text-green-400 font-bold">
      {entry.amount.toLocaleString()} $
    </td>
    <td className="px-4 py-4">
       <div className="space-y-2">
          {(entry.participations || []).map((part, pIdx) => (
            <div key={pIdx} className="flex items-center gap-1.5">
              {entry.isNew ? (
                <>
                  <select
                    className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 flex-1"
                    value={part.employeeId}
                    onChange={(e) => {
                      const newParts = [...entry.participations];
                      newParts[pIdx].employeeId = e.target.value;
                      updatePreviewEntry(idx, { participations: newParts });
                    }}
                  >
                    <option value="">Employé</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.user.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    className="w-10 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px]"
                    value={part.percentage}
                    onChange={(e) => {
                      const newParts = [...entry.participations];
                      newParts[pIdx].percentage = e.target.value;
                      updatePreviewEntry(idx, { participations: newParts });
                    }}
                  />
                  <button onClick={() => removeParticipationRow(idx, pIdx)} className="text-slate-600 hover:text-red-400 p-0.5"><X size={12} /></button>
                </>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <div className="w-4 h-4 rounded-full bg-indigo-600/30 text-[8px] flex items-center justify-center text-indigo-400">{part.employeeName?.charAt(0)}</div>
                  {part.employeeName} : {part.percentage}%
                </div>
              )}
            </div>
          ))}
          {entry.isNew && (
            <button 
              onClick={() => addParticipationRow(idx)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus size={10} /> Ajouter
            </button>
          )}
          {!entry.isNew && entry.participations.length === 0 && (
            <span className="text-[10px] text-slate-600 italic">Aucune</span>
          )}
       </div>
    </td>
  </tr>
);

const StatCard = ({ label, value, icon: Icon, color, subValue }) => {
  const colorMap = {
    green: 'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/20',
    rose: 'from-rose-500/20 to-red-500/20 text-rose-400 border-rose-500/20',
    indigo: 'from-indigo-500/20 to-blue-500/20 text-indigo-400 border-indigo-500/20',
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/20',
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/20',
  };

  return (
    <div className={`p-4 md:p-5 rounded-2xl bg-gradient-to-br ${colorMap[color] || colorMap.indigo} border backdrop-blur-xl relative overflow-hidden group`}>
      <Icon className="absolute -right-2 -bottom-2 w-16 h-16 md:w-20 md:h-20 opacity-5 group-hover:scale-110 transition-transform" />
      <div className="relative z-10">
        <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">{label}</p>
        <p className="text-xl md:text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-[9px] md:text-[10px] mt-1 opacity-50">{subValue}</p>
      </div>
    </div>
  );
};

export default SacemPage;
