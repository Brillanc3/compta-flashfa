import React, { useState } from 'react';
import { Plus, Trash2, BarChart2 } from 'lucide-react';

export default function PollComposer({ onConfirm, onCancel }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [multiple, setMultiple] = useState(false);
    const [expiresAt, setExpiresAt] = useState('');
    const [error, setError] = useState(null);

    const addOption = () => {
        if (options.length < 10) setOptions(prev => [...prev, '']);
    };

    const removeOption = (idx) => {
        if (options.length <= 2) return;
        setOptions(prev => prev.filter((_, i) => i !== idx));
    };

    const setOption = (idx, val) => {
        setOptions(prev => prev.map((o, i) => i === idx ? val : o));
    };

    const MAX_WEEKS = 2;

    const handleConfirm = () => {
        setError(null);
        if (!question.trim()) { setError('La question est requise'); return; }
        const filled = options.map(o => o.trim()).filter(Boolean);
        if (filled.length < 2) { setError('Au moins 2 options sont requises'); return; }

        let resolvedExpiry = undefined;
        if (expiresAt) {
            const chosen = new Date(expiresAt);
            const maxDate = new Date(Date.now() + MAX_WEEKS * 7 * 24 * 60 * 60 * 1000);
            if (chosen > maxDate) {
                setError(`Expiration max : ${MAX_WEEKS} semaines`);
                return;
            }
            if (chosen <= new Date()) {
                setError('La date d\'expiration doit être dans le futur');
                return;
            }
            resolvedExpiry = chosen.toISOString();
        }

        onConfirm({
            question: question.trim(),
            options: filled,
            multiple,
            expiresAt: resolvedExpiry,
        });
    };

    const maxDateStr = (() => {
        const d = new Date(Date.now() + MAX_WEEKS * 7 * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 16);
    })();

    return (
        <div className="rounded-xl border border-cca-border bg-cca-surface p-3 mt-2 max-w-sm">
            <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-brand-primary shrink-0" />
                <span className="text-sm font-semibold text-cca-textPrimary">Créer un sondage</span>
            </div>

            <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                maxLength={300}
                placeholder="Question…"
                className="w-full bg-cca-base border border-cca-border rounded-lg px-3 py-1.5 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/50 mb-3 outline-none focus:border-brand-primary"
            />

            <div className="space-y-1.5 mb-2">
                {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                        <input
                            value={opt}
                            onChange={e => setOption(idx, e.target.value)}
                            maxLength={100}
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 bg-cca-base border border-cca-border rounded-lg px-2.5 py-1 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/50 outline-none focus:border-brand-primary"
                        />
                        {options.length > 2 && (
                            <button type="button" onClick={() => removeOption(idx)} className="p-1 text-cca-textSecondary hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {options.length < 10 && (
                <button type="button" onClick={addOption} className="flex items-center gap-1 text-xs text-brand-primary hover:underline mb-3">
                    <Plus className="w-3 h-3" /> Ajouter une option
                </button>
            )}

            <div className="flex items-center gap-2 mb-2">
                <input
                    type="checkbox"
                    id="poll-multiple"
                    checked={multiple}
                    onChange={e => setMultiple(e.target.checked)}
                    className="accent-brand-primary"
                />
                <label htmlFor="poll-multiple" className="text-xs text-cca-textSecondary select-none">Choix multiples</label>
            </div>

            <div className="mb-3">
                <label className="text-xs text-cca-textSecondary mb-1 block">Expiration (optionnel)</label>
                <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    max={maxDateStr}
                    className="w-full bg-cca-base border border-cca-border rounded-lg px-2.5 py-1 text-sm text-cca-textPrimary outline-none focus:border-brand-primary"
                />
            </div>

            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

            <div className="flex gap-2">
                <button type="button" onClick={onCancel} className="flex-1 py-1.5 rounded-lg border border-cca-border text-sm text-cca-textSecondary hover:bg-cca-base transition-colors">
                    Annuler
                </button>
                <button type="button" onClick={handleConfirm} className="flex-1 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors">
                    Créer
                </button>
            </div>
        </div>
    );
}
