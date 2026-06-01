// /frontend/src/components/dashboard/RankFormModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import {
    createRank,
    updateRank,
    getAvailablePermissionTemplates,
    getRemunerationSchemaForCompany,
    getRankFormSettings,
} from '@/services/employeesService';
import toast from 'react-hot-toast';
import Spinner from '../ui/Spinner';
import DynamicFormField from '../form/DynamicFormField';

const RankFormModal = ({ isOpen, onClose, companyId, rankToEdit, onComplete }) => {
    const isEditMode = !!rankToEdit;

    const [name, setName] = useState('');
    const [salaryCap, setSalaryCap] = useState('');
    const [remunerationSchema, setRemunerationSchema] = useState([]);
    const [remunerationValues, setRemunerationValues] = useState({});
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [formSettings, setFormSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [groupRankId, setGroupRankId] = useState('');

    // Search for permissions
    const [permissionQuery, setPermissionQuery] = useState('');

    /* ============================================================
       LOAD INITIAL FORM SETTINGS
    ============================================================ */
    useEffect(() => {
        if (isOpen && companyId) {
            setLoading(true);

            Promise.all([
                getRemunerationSchemaForCompany(companyId),
                getAvailablePermissionTemplates(companyId),
                getRankFormSettings(companyId, rankToEdit?.name),
            ])
                .then(([schema, permissions, settings]) => {
                    setRemunerationSchema(schema);
                    setAvailablePermissions(permissions);
                    setFormSettings(settings);

                    if (isEditMode && rankToEdit) {
                        setName(rankToEdit.name);
                        setGroupRankId(rankToEdit.groupRankId || '');
                        setSalaryCap(rankToEdit.salaryCap || '');
                        setSelectedPermissions(
                            rankToEdit.permissionTemplates?.map((p) => p.action) || []
                        );

                        let config = rankToEdit.remunerationConfig || {};

                        if (typeof config === "string") {
                            try {
                                config = JSON.parse(config);
                            } catch {
                                // keep raw if parsing fails
                            }
                        }
                        setRemunerationValues(config);
                    } else {
                        setName('');
                        setGroupRankId('');
                        setSalaryCap('');
                        setSelectedPermissions([]);
                        setPermissionQuery('');

                        const defaults = {};
                        schema.forEach((field) => {
                            defaults[field.key] = field.default ?? {};
                        });

                        setRemunerationValues(defaults);
                    }
                })
                .catch((err) => {
                    console.error("[RANK FORM] Error loading form settings", err);
                    toast.error('Impossible de charger la configuration du formulaire.');
                    onClose();
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, companyId, rankToEdit, isEditMode, onClose]);

    /* ============================================================
       ON CHANGE OF REMUNERATION FIELD
    ============================================================ */
    const handleFieldChange = (key, val) => {
        setRemunerationValues((prev) => ({ ...prev, [key]: val }));
    };

    /* ============================================================
       PERMISSIONS
    ============================================================ */
    const handlePermissionChange = (perm) => {
        setSelectedPermissions((prev) =>
            prev.includes(perm)
                ? prev.filter((p) => p !== perm)
                : [...prev, perm]
        );
    };

    const groupedPermissions = useMemo(() => {
        const q = permissionQuery.trim().toLowerCase();

        const filtered = (availablePermissions || []).filter((p) => {
            const label = String(p?.label ?? '').toLowerCase();
            const action = String(p?.action ?? '').toLowerCase();
            const moduleLabel = String(p?.moduleLabel ?? '').toLowerCase();
            const moduleName = String(p?.moduleName ?? '').toLowerCase();

            if (!q) return true;
            return (
                label.includes(q) ||
                action.includes(q) ||
                moduleLabel.includes(q) ||
                moduleName.includes(q)
            );
        });

        const groups = new Map();
        for (const p of filtered) {
            const key = p?.moduleLabel || p?.moduleName || 'Autres';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        }

        for (const [, list] of groups.entries()) {
            list.sort((a, b) => {
                const aLabel = String(a?.label ?? a?.action ?? '');
                const bLabel = String(b?.label ?? b?.action ?? '');
                return aLabel.localeCompare(bLabel);
            });
        }

        return Array.from(groups.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    }, [availablePermissions, permissionQuery]);

    const filteredCount = useMemo(() => {
        return groupedPermissions.reduce((acc, [, perms]) => acc + perms.length, 0);
    }, [groupedPermissions]);

    /* ============================================================
       SUBMISSION
    ============================================================ */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const selectedPermissionTemplateIds = availablePermissions
            .filter((p) => selectedPermissions.includes(p.action))
            .map((p) => p.id);

        const rankData = {
            name,
            groupRankId: groupRankId ? parseInt(groupRankId, 10) : null,
            salaryCap: salaryCap ? parseFloat(salaryCap) : null,
            remunerationConfig: remunerationValues,
            permissionTemplateIds: selectedPermissionTemplateIds,
        };

        try {
            if (isEditMode) {
                await updateRank(companyId, rankToEdit.id, rankData);
                toast.success('Rang mis à jour.');
            } else {
                await createRank(companyId, rankData);
                toast.success('Nouveau rang créé.');
            }
            onComplete();
            onClose();
        } catch (error) {
            console.error("[RANK FORM] ERROR FROM API", error);
            toast.error(error.message || 'Erreur lors de la sauvegarde.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Modifier le Rang' : 'Créer un Nouveau Rang'}
            disableOverlayClose={true}
        >
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Spinner />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* === Infos de base === */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-bold text-cca-textPrimary">
                            Nom du rang
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="mt-1 w-full bg-cca-base border border-cca-border rounded-xl p-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="groupRankId" className="block text-sm font-bold text-cca-textPrimary">
                            ID du Groupe de Rangs (optionnel)
                        </label>

                        <input
                            type="number"
                            id="groupRankId"
                            value={groupRankId}
                            onChange={(e) => setGroupRankId(e.target.value)}
                            min="0"
                            placeholder="Laisser vide si aucun groupe"
                            className="mt-1 w-full bg-cca-base border border-cca-border rounded-xl p-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="salaryCap" className="block text-sm font-bold text-cca-textPrimary">
                            Plafond de Salaire Hebdomadaire ($)
                        </label>
                        <input
                            type="number"
                            id="salaryCap"
                            value={salaryCap}
                            onChange={(e) => setSalaryCap(e.target.value)}
                            min="0"
                            max={formSettings?.maxSalaryCap}
                            step="100"
                            placeholder={`Max autorisé : ${formSettings?.maxSalaryCap ?? 0}$`}
                            className="mt-1 w-full bg-cca-base border border-cca-border rounded-xl p-3 text-cca-textPrimary focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
                        />
                    </div>

                    {/* === Schéma Rémunération === */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-cca-textPrimary flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-indigo-500" />
                            Configuration de la rémunération
                        </h3>

                        {remunerationSchema.length === 0 && (
                            <p className="text-cca-textSecondary text-sm">Aucun module actif pour cette entreprise.</p>
                        )}

                        {remunerationSchema.map((field) => (
                            <DynamicFormField
                                key={field.key}
                                field={field}
                                value={remunerationValues[field.key]}
                                onChange={(val) => handleFieldChange(field.key, val)}
                                context={{ companyId }}
                            />
                        ))}
                    </div>

                    {/* === Permissions === */}
                    <div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <label className="block text-sm font-bold text-cca-textPrimary">
                                    Permissions du rang
                                </label>
                                <p className="mt-1 text-xs text-cca-textSecondary">
                                    Rechercher par module, description ou clé.
                                </p>
                            </div>

                            <div className="w-full sm:w-96">
                                <input
                                    value={permissionQuery}
                                    onChange={(e) => setPermissionQuery(e.target.value)}
                                    placeholder="Rechercher une permission…"
                                    className="w-full bg-cca-base border border-cca-border rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                                />
                            </div>
                        </div>

                        <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-cca-border bg-cca-surface shadow-inner">
                            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-cca-border bg-cca-surface/80 backdrop-blur-md">
                                <span className="text-xs font-bold text-cca-textSecondary uppercase tracking-widest">
                                    {filteredCount} affichée(s) • {selectedPermissions.length} sélectionnée(s)
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const actions = groupedPermissions.flatMap(([, perms]) => perms.map((p) => p.action));
                                            setSelectedPermissions((prev) => Array.from(new Set([...prev, ...actions])));
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-cca-base hover:bg-cca-border text-cca-textSecondary border border-cca-border transition active:scale-95"
                                    >
                                        Tout cocher
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const actionsSet = new Set(
                                                groupedPermissions.flatMap(([, perms]) => perms.map((p) => p.action))
                                            );
                                            setSelectedPermissions((prev) => prev.filter((a) => !actionsSet.has(a)));
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-cca-base hover:bg-cca-border text-cca-textSecondary border border-cca-border transition active:scale-95"
                                    >
                                        Tout décocher
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 space-y-6">
                                {groupedPermissions.length === 0 ? (
                                    <div className="text-sm text-slate-400 py-6 text-center">
                                        Aucune permission ne correspond à la recherche.
                                    </div>
                                ) : (
                                    groupedPermissions.map(([groupName, perms]) => (
                                        <div key={groupName} className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-bold text-cca-textPrimary">
                                                    {groupName}
                                                </div>
                                                <div className="text-[10px] font-black text-cca-textSecondary/60 bg-cca-base px-2 py-0.5 rounded-full border border-cca-border">
                                                    {perms.length}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {perms.map((perm) => {
                                                    const checked = selectedPermissions.includes(perm.action);
                                                    const displayLabel = perm.label ?? perm.action;
                                                    const showAction = perm.label && perm.label !== perm.action;

                                                    return (
                                                        <div
                                                            key={perm.action}
                                                            className={`flex items-start justify-between gap-4 rounded-xl border px-3 py-2.5 transition
                                                                ${checked
                                                                ? "bg-indigo-600/10 border-indigo-500/40 shadow-sm shadow-indigo-500/10"
                                                                : "bg-cca-base/30 border-cca-border hover:border-cca-textSecondary/30"
                                                            }`}
                                                        >
                                                            <label
                                                                htmlFor={`perm-${perm.action}`}
                                                                className="min-w-0 flex-1 cursor-pointer select-none"
                                                            >
                                                                <div className="text-sm text-cca-textPrimary font-semibold break-words leading-5">
                                                                    {displayLabel}
                                                                </div>

                                                                {showAction && (
                                                                    <div className="mt-0.5 text-[10px] text-cca-textSecondary font-medium break-all uppercase tracking-wider">
                                                                        {perm.action}
                                                                    </div>
                                                                )}
                                                            </label>

                                                            <button
                                                                type="button"
                                                                role="switch"
                                                                aria-checked={checked}
                                                                onClick={() => handlePermissionChange(perm.action)}
                                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition
                                                                    ${checked
                                                                    ? "bg-indigo-600 border-indigo-500/40"
                                                                    : "bg-cca-base border-cca-border hover:bg-cca-border/80 text-cca-textSecondary"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition
                                                                        ${checked ? "translate-x-5" : "translate-x-0.5"}`}
                                                                />
                                                                <span className="sr-only">Activer / désactiver</span>
                                                            </button>

                                                            <input
                                                                id={`perm-${perm.action}`}
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => handlePermissionChange(perm.action)}
                                                                className="hidden"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* === Actions === */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-cca-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 bg-cca-base hover:bg-cca-border text-cca-textPrimary font-bold rounded-xl border border-cca-border transition active:scale-95"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>

                </form>
            )}
        </Modal>
    );
};

export default RankFormModal;
