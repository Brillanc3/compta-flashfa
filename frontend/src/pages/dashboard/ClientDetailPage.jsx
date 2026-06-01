// frontend/src/pages/dashboard/ClientDetailPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getClientDetails, updateClient, getClientVariableValues, setClientVariableValue } from '@/services/clientsService.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, MapPin, Edit2, Check, X } from 'lucide-react';
import ClientFidelityCardManager from '@/components/clients/ClientFidelityCardManager';

import Spinner from '@/components/ui/Spinner';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { usePermissions } from '@/contexts/PermissionsContext.jsx';

// Badge de statut
// Badge de statut des factures
const BillStatusBadge = ({ status }) => {
    const statusConfig = {
        unpaid: { label: 'Non payé', class: 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' },
        paid_by_card: { label: 'Payé par Carte', class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' },
        paid_by_cash: { label: 'Payé en Espèces', class: 'bg-sky-500/10 text-sky-500 border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]' },
    };
    
    const config = statusConfig[status] || { label: status || 'Inconnu', class: 'bg-cca-surface/40 text-cca-textSecondary/60 border-cca-border' };
    
    return (
        <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg inline-flex items-center border ${config.class}`}>
            {config.label}
        </span>
    );
};

// ── Variable Value Card ───────────────────────────────────────────────────────
const VariableValueCard = ({ variable, cfg, isTrue: _isTrue, permsSet, companyId, clientId, onUpdated }) => {
    const canEdit = permsSet.has('ADMIN.*') || permsSet.has(`COMPANY.${companyId}.*`) || permsSet.has('clients.variables.manage');
    const [editing, setEditing] = useState(false);
    const [localValue, setLocalValue] = useState(variable.value ?? null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setClientVariableValue(clientId, variable.id, localValue);
            onUpdated(localValue);
            toast.success(`"${variable.label}" mis à jour.`);
            setEditing(false);
        } catch (e) {
            toast.error(e.message || 'Erreur.');
        } finally {
            setSaving(false);
        }
    };

    const displayBool = variable.type === 'BOOLEAN'
        ? (variable.value === 'true' ? (cfg.trueIcon || cfg.trueLabel || 'Oui') : (cfg.falseIcon || cfg.falseLabel || 'Non'))
        : (variable.value || '—');

    return (
        <div className="group rounded-2xl bg-cca-surface/30 border border-cca-border p-4 space-y-2 hover:border-brand-primary/20 transition-all">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40">{variable.label}</p>
                {canEdit && !editing && (
                    <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cca-base/40 text-cca-textSecondary/40 hover:text-brand-primary transition-all">
                        <Edit2 size={12} />
                    </button>
                )}
            </div>

            {!editing ? (
                <p className="text-lg font-black text-cca-textPrimary">{displayBool}</p>
            ) : variable.type === 'BOOLEAN' ? (
                <div className="flex gap-2">
                    <button onClick={() => { setLocalValue('true'); }} className={`flex-1 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${localValue === 'true' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-cca-base/30 border-cca-border text-cca-textSecondary'}`}>
                        {cfg.trueIcon || cfg.trueLabel || 'Oui'}
                    </button>
                    <button onClick={() => { setLocalValue('false'); }} className={`flex-1 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${localValue === 'false' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-cca-base/30 border-cca-border text-cca-textSecondary'}`}>
                        {cfg.falseIcon || cfg.falseLabel || 'Non'}
                    </button>
                </div>
            ) : (
                <input
                    className="w-full bg-cca-base/40 border border-cca-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-primary transition-all"
                    value={localValue || ''}
                    onChange={e => setLocalValue(e.target.value)}
                    autoFocus
                />
            )}

            {editing && (
                <div className="flex gap-2 pt-1">
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                        <Check size={12} /> {saving ? '...' : 'OK'}
                    </button>
                    <button onClick={() => { setEditing(false); setLocalValue(variable.value ?? null); }}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-cca-base/30 border border-cca-border text-cca-textSecondary font-black text-[10px] uppercase tracking-widest hover:bg-cca-base/60 transition-all">
                        <X size={12} /> Annuler
                    </button>
                </div>
            )}
        </div>
    );
};

const ClientDetailPage = () => {
    const { clientId } = useParams();
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;
    const { permsSet } = usePermissions();

    // Variables
    const [variableValues, setVariableValues] = useState([]);

    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        address: '',
        iban: '',
        cni: ''
    });

    // Filtres (mobile-first) sur l'historique des factures
    const [billQuery, setBillQuery] = useState('');
    const [billStatus, setBillStatus] = useState('all');

    const fetchClientDetails = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getClientDetails(companyId, clientId);
            setClient(data);
            setFormData({
                name: data.name,
                phoneNumber: data.phoneNumber || '',
                address: data.address || '',
                iban: data.iban || '',
                cni: data.cni || '',
            });
        } catch (err) {
            toast.error(err.message || "Erreur.");
        }
        setLoading(false);
    }, [companyId, clientId]);

    useEffect(() => {
        fetchClientDetails();
    }, [fetchClientDetails]);

    // Charger les valeurs de variables pour ce client
    useEffect(() => {
        if (!clientId) return;
        getClientVariableValues(clientId)
            .then(data => {
                setVariableValues(Array.isArray(data) ? data : []);
            })
            .catch(err => {
                console.warn('[ClientDetail] Variables load error:', err);
            });
    }, [clientId]);


    const handleFormChange = (e) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            const updated = await updateClient(companyId, clientId, formData);
            setClient(prev => ({ ...prev, ...updated }));
            toast.success("Client mis à jour avec succès !");
            setIsEditing(false);
        } catch (err) {
            toast.error(err.message || "Erreur lors de la mise à jour.");
        }
    };

    const formatUSD = useCallback((value) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(value ?? 0);
    }, []);

    const bills = useMemo(() => {
        const list = client?.bills;
        return Array.isArray(list) ? list : [];
    }, [client]);

    const filteredBills = useMemo(() => {
        const q = billQuery.trim().toLowerCase();
        return bills.filter(bill => {
            if (billStatus !== 'all' && bill?.status !== billStatus) return false;
            if (!q) return true;

            const haystack = [
                bill?.reason,
                bill?.status,
                bill?.amount != null ? String(bill.amount) : '',
                bill?.date,
            ].filter(Boolean).join(' ').toLowerCase();

            return haystack.includes(q);
        });
    }, [bills, billQuery, billStatus]);

    if (loading) return <div className="flex justify-center p-24"><Spinner /></div>;
    if (!client) return (
        <div className="flex flex-col items-center justify-center p-24 rounded-3xl bg-cca-surface/20 border border-cca-border">
            <p className="text-rose-500 font-black uppercase tracking-widest">Client introuvable</p>
            <Link to="/dashboard/company/clients" className="mt-4 text-xs font-bold text-brand-primary hover:underline transition-all">Retour à la liste</Link>
        </div>
    );

    const avatarInitial = (client.name?.charAt(0) || '?').toUpperCase();

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
            <Link
                to={`/dashboard/company/clients`}
                className="group inline-flex items-center gap-2 text-cca-textSecondary/60 hover:text-brand-primary text-[10px] font-black uppercase tracking-widest transition-all"
            >
                <div className="p-1.5 rounded-lg bg-cca-surface/40 border border-cca-border group-hover:border-brand-primary/40 transition-all">
                    <ArrowBackIcon sx={{ fontSize: 14 }} />
                </div>
                Retour au Répertoire
            </Link>

            {/* === CARTE CLIENT === */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40 p-1 sm:p-1"
            >
                <div className="
                    pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay
                    bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
                " />

                <div className="relative p-6 sm:p-10 flex flex-col lg:flex-row gap-8 sm:gap-12">
                    {/* Avatar Side */}
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary to-indigo-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-cca-base border-4 border-cca-surface flex items-center justify-center text-4xl sm:text-6xl font-black text-brand-primary shadow-2xl">
                                {avatarInitial}
                            </div>
                            <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-cca-base flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                            </div>
                        </div>
                        
                        <div className="text-center space-y-1">
                             <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">Identifiant Unique</div>
                             <div className="text-xs font-mono text-brand-primary/60 font-bold">#CLI-{client.id}</div>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 space-y-8">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Fiche Signalétique Professionnelle</p>
                                <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-cca-textPrimary font-heading">{client.name}</h2>
                            </div>

                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
                                >
                                    <EditIcon sx={{ fontSize: 16 }} /> Modifier
                                </button>
                            )}
                        </div>

                        {/* === MODE VISUEL === */}
                        {!isEditing && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">Ligne Directe</p>
                                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border text-cca-textPrimary font-bold text-sm tracking-tight flex items-center gap-3">
                                            <div className="p-1.5 rounded-lg bg-cca-surface/50 text-brand-primary"><Phone size={14} /></div>
                                            {client.phoneNumber || 'Non renseigné'}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">Domiciliation des Factures</p>
                                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border text-cca-textPrimary font-bold text-sm tracking-tight flex items-center gap-3">
                                            <div className="p-1.5 rounded-lg bg-cca-surface/50 text-brand-primary"><MapPin size={14} /></div>
                                            {client.address || 'Aucune adresse enregistrée'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">Informations Bancaires (IBAN)</p>
                                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border text-cca-textPrimary font-mono font-bold text-xs tracking-wider flex items-center gap-3">
                                            {client.iban || 'Non communiqué'}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">Identité (CNI)</p>
                                        <div className="p-4 rounded-2xl bg-cca-base/40 border border-cca-border text-cca-textPrimary font-bold text-sm flex items-center justify-between">
                                            <span className="blur-md select-none hover:blur-none transition-all duration-500 font-mono tracking-tighter">{client.cni || 'Non archivé'}</span>
                                            <InfoOutlinedIcon sx={{ fontSize: 16 }} className="text-cca-textSecondary/40" />
                                        </div>
                                    </div>
                                </div>

                                {/* Carte fidélité */}
                                <div className="md:col-span-2 pt-6">
                                    <ClientFidelityCardManager
                                        client={client}
                                        companyId={parseInt(companyId)}
                                        onUpdate={(data) => setClient(prev => ({ ...prev, ...data }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* === MODE EDITION === */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.form
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    onSubmit={handleFormSubmit}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                >
                                    {[
                                        { label: "Nom complet", name: "name", placeholder: "Ex: John Doe" },
                                        { label: "Téléphone", name: "phoneNumber", placeholder: "Ex: 555-0123" },
                                        { label: "Adresse Postale", name: "address", placeholder: "Ex: 123 Rue de la Liberté" },
                                        { label: "IBAN Bancaire", name: "iban", placeholder: "Ex: FR76..." },
                                        { label: "N° Pièce d'Identité", name: "cni", placeholder: "Ex: CNI-9988..." },
                                    ].map(field => (
                                        <div key={field.name} className="space-y-2">
                                            <label htmlFor={field.name} className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">
                                                {field.label}
                                            </label>
                                            <input
                                                id={field.name}
                                                name={field.name}
                                                value={formData[field.name]}
                                                onChange={handleFormChange}
                                                placeholder={field.placeholder}
                                                className="w-full bg-cca-base/40 border border-cca-border rounded-2xl p-3.5 text-sm font-bold text-white outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition-all"
                                            />
                                        </div>
                                    ))}

                                    <div className="flex flex-col sm:flex-row gap-4 md:col-span-2 pt-6">
                                        <button 
                                            type="submit" 
                                            className="flex-1 px-8 py-4 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
                                        >
                                            Sauvegarder les modifications
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsEditing(false)} 
                                            className="px-8 py-4 bg-cca-surface/40 border border-cca-border text-cca-textPrimary text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-cca-surface active:scale-95 transition-all"
                                        >
                                            Abandonner
                                        </button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            {/* === HISTORIQUE DES FACTURES === */}
            <div className="rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40 overflow-hidden">
                <div className="p-8 sm:p-10 border-b border-cca-border/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div className="space-y-1">
                            <h3 className="text-xl sm:text-3xl font-black tracking-tight text-white font-heading">Livre de Facturation</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40">Historique transactionnel exhaustif</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-cca-base/40 border border-cca-border text-[10px] font-black uppercase tracking-widest text-cca-textPrimary">
                             {filteredBills.length} Opérations <span className="mx-1 opacity-20">|</span> Total {bills.length}
                        </div>
                    </div>

                    {/* Barre de recherche + filtre */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Recherche contextuelle</label>
                            <input
                                value={billQuery}
                                onChange={(e) => setBillQuery(e.target.value)}
                                placeholder="Filtrer par description, montant, date..."
                                className="w-full bg-cca-base/40 border border-cca-border rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-cca-textSecondary/20 outline-none focus:border-brand-primary transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">État de paiement</label>
                            <select
                                value={billStatus}
                                onChange={(e) => setBillStatus(e.target.value)}
                                className="w-full bg-cca-base/40 border border-cca-border rounded-2xl px-5 py-3.5 text-sm text-white appearance-none outline-none focus:border-brand-primary transition-all"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="unpaid">Non Soldées (Unpaid)</option>
                                <option value="paid_by_card">Soldées par Carte</option>
                                <option value="paid_by_cash">Soldées en Espèces</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => { setBillQuery(''); setBillStatus('all'); }}
                            className="h-[52px] px-6 rounded-2xl bg-cca-surface/40 border border-cca-border text-[9px] font-black uppercase tracking-[0.2em] text-cca-textPrimary hover:bg-cca-surface transition-all active:scale-95"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Table Logic */}
                <div className="relative">
                     {filteredBills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 opacity-30 text-center space-y-4">
                            <InfoOutlinedIcon sx={{fontSize: 48}} />
                            <p className="text-sm font-black uppercase tracking-widest">Aucune donnée transactionnelle identifiée</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-cca-surface/40">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 border-b border-cca-border text-left">Date d'Émission</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 border-b border-cca-border text-left">Libellé de la Prestation</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 border-b border-cca-border text-right">Montant Exigible</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 border-b border-cca-border text-center">Statut Actuel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cca-border/20">
                                {filteredBills.map(bill => (
                                    <tr key={bill.id} className="group hover:bg-brand-primary/5 transition-all duration-300">
                                        <td className="px-8 py-5 text-xs font-bold text-cca-textSecondary group-hover:text-cca-textPrimary transition-colors">
                                            {bill?.date ? format(new Date(bill.date), 'dd MMM yyyy', { locale: fr }) : '—'}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-black text-white/90 group-hover:text-brand-primary transition-colors tracking-tight">{bill?.reason || 'Sans libellé'}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right font-mono font-black text-brand-primary text-sm tracking-tighter">
                                            {formatUSD(bill?.amount)}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <BillStatusBadge status={bill.status} />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ──── SECTION VARIABLES ──── */}
            {variableValues.length > 0 && (
                <div className="rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-cca-border/30">
                        <h2 className="text-lg font-black text-cca-textPrimary tracking-tighter">Paramètres Client</h2>
                        <p className="text-[10px] text-cca-textSecondary/40 mt-0.5">Variables personnalisées</p>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {variableValues.map(v => {
                            const cfg = v.config || {};
                            const isTrue = v.value === 'true';
                            return (
                                <VariableValueCard
                                    key={v.id}
                                    variable={v}
                                    cfg={cfg}
                                    isTrue={isTrue}
                                    permsSet={permsSet}
                                    companyId={companyId}
                                    clientId={clientId}
                                    onUpdated={(newVal) => setVariableValues(prev => prev.map(x => x.id === v.id ? { ...x, value: newVal } : x))}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetailPage;
