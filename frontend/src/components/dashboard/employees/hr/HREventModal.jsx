// frontend/src/components/dashboard/employees/hr/HREventModal.jsx

import React, { useState, useEffect } from 'react';
import { X, Paperclip } from 'lucide-react';
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
import toast from 'react-hot-toast';
import { createHREvent, updateHREvent, uploadHRAttachment } from '@/services/employeesHrService';

const TYPES = [
    { value: 'AVERTISSEMENT', label: 'Avertissement' },
    { value: 'FELICITATION',  label: 'Félicitation' },
    { value: 'PRIME',         label: 'Prime' },
    { value: 'NOTE',          label: 'Note' },
];

const defaultState = () => ({
    type: 'NOTE',
    title: '',
    description: '',
    amount: '',
    isoWeek: String(getISOWeek(new Date())),
    isoYear: String(getISOWeekYear(new Date())),
    occurredAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    expiresAt: '',
});

const HREventModal = ({ companyId, employeeId, event, onClose, onSuccess }) => {
    const isEdit = !!event;
    const [form, setForm] = useState(defaultState());
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setForm({
                type: event.type,
                title: event.title,
                description: event.description ?? '',
                amount: event.amount != null ? String(event.amount) : '',
                isoWeek: event.isoWeek != null ? String(event.isoWeek) : String(getISOWeek(new Date())),
                isoYear: event.isoYear != null ? String(event.isoYear) : String(getISOWeekYear(new Date())),
                occurredAt: event.occurredAt
                    ? format(new Date(event.occurredAt), "yyyy-MM-dd'T'HH:mm")
                    : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                expiresAt: event.expiresAt
                    ? format(new Date(event.expiresAt), "yyyy-MM-dd'T'HH:mm")
                    : '',
            });
        }
    }, [event]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                type: form.type,
                title: form.title,
                description: form.description || undefined,
                occurredAt: form.occurredAt,
                expiresAt: form.expiresAt || undefined,
                ...(form.type === 'PRIME' && {
                    amount: parseFloat(form.amount),
                    isoWeek: parseInt(form.isoWeek, 10),
                    isoYear: parseInt(form.isoYear, 10),
                }),
            };

            let saved;
            if (isEdit) {
                saved = await updateHREvent(companyId, employeeId, event.id, payload);
            } else {
                saved = await createHREvent(companyId, employeeId, payload);
            }

            for (const file of files) {
                await uploadHRAttachment(companyId, employeeId, saved.id, file);
            }

            toast.success(isEdit ? 'Événement mis à jour.' : 'Événement créé.');
            onSuccess();
        } catch (err) {
            toast.error(err?.message || 'Erreur lors de la sauvegarde.');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full bg-cca-base text-cca-textPrimary border border-cca-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary/50";
    const labelClass = "block text-[10px] font-black uppercase tracking-wider text-cca-textSecondary/60 mb-1";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-cca-surface border border-cca-border rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-cca-border/50">
                    <h2 className="font-black text-sm uppercase tracking-widest text-cca-textPrimary">
                        {isEdit ? 'Modifier' : 'Nouvel'} événement RH
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-cca-base/40 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelClass}>Type</label>
                        <select
                            value={form.type}
                            onChange={e => set('type', e.target.value)}
                            className={inputClass}
                            disabled={isEdit}
                        >
                            {TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Titre *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            required
                            className={inputClass}
                            placeholder="Titre de l'événement"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            className={`${inputClass} h-24 resize-none`}
                            placeholder="Description optionnelle..."
                        />
                    </div>

                    {form.type === 'PRIME' && (
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>Montant ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.amount}
                                    onChange={e => set('amount', e.target.value)}
                                    required
                                    className={inputClass}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Semaine ISO *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="53"
                                    value={form.isoWeek}
                                    onChange={e => set('isoWeek', e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Année *</label>
                                <input
                                    type="number"
                                    min="2020"
                                    value={form.isoYear}
                                    onChange={e => set('isoYear', e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>Date de l'événement</label>
                        <input
                            type="datetime-local"
                            value={form.occurredAt}
                            onChange={e => set('occurredAt', e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    {(form.type === 'AVERTISSEMENT' || form.type === 'NOTE') && (
                        <div>
                            <label className={labelClass}>Date de fin / expiration</label>
                            <input
                                type="datetime-local"
                                value={form.expiresAt}
                                onChange={e => set('expiresAt', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    )}

                    {!isEdit && (
                        <div>
                            <label className={labelClass}>
                                <Paperclip size={10} className="inline mr-1" />
                                Pièces jointes
                            </label>
                            <input
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt"
                                onChange={e => setFiles(Array.from(e.target.files))}
                                className="w-full text-sm text-cca-textSecondary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:uppercase file:bg-cca-base file:text-cca-textSecondary hover:file:bg-cca-border/40"
                            />
                            {files.length > 0 && (
                                <p className="text-[10px] text-cca-textSecondary/40 mt-1">
                                    {files.length} fichier(s) sélectionné(s)
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-cca-border text-cca-textSecondary text-sm font-black uppercase tracking-wider hover:bg-cca-base/40 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 rounded-xl bg-brand-primary text-white text-sm font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? 'Sauvegarde...' : isEdit ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HREventModal;
