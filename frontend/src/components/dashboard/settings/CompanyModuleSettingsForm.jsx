import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Spinner from "@/components/ui/Spinner";
import { updateCompanySettingsJson } from "@/services/companyService";

function isObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
}

function getByPath(obj, path) {
    return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function setByPath(obj, path, value) {
    const keys = path.split(".");
    const out = { ...(obj || {}) };
    let cur = out;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        cur[k] = isObject(cur[k]) ? { ...cur[k] } : {};
        cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    return out;
}

function FieldRenderer({ field, path, value, onChange }) {
    const commonLabel = (
        <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-200">{field.label || path}</label>
            {field.description && (
                <p className="text-xs text-slate-400">{field.description}</p>
            )}
        </div>
    );

    if (field.type === "string") {
        return (
            <div className="space-y-2">
                {commonLabel}
                <input
                    value={value ?? ""}
                    onChange={(e) => onChange(path, e.target.value)}
                    maxLength={field.maxLength || undefined}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-slate-500"
                    placeholder={field.placeholder || ""}
                />
            </div>
        );
    }

    if (field.type === "number") {
        return (
            <div className="space-y-2">
                {commonLabel}
                <input
                    type="number"
                    value={value ?? ""}
                    onChange={(e) => {
                        const v = e.target.value;
                        onChange(path, v === "" ? null : Number(v));
                    }}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-slate-500"
                />
            </div>
        );
    }

    if (field.type === "boolean") {
        return (
            <div className="flex items-start justify-between gap-6">
                {commonLabel}
                <button
                    type="button"
                    onClick={() => onChange(path, !value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                        value
                            ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-200"
                            : "bg-slate-900/60 border-white/10 text-slate-200"
                    }`}
                >
                    {value ? "Activé" : "Désactivé"}
                </button>
            </div>
        );
    }

    if (field.type === "string_array") {
        const arr = Array.isArray(value) ? value : [];
        return (
            <div className="space-y-2">
                {commonLabel}
                <div className="space-y-2">
                    {arr.map((item, idx) => (
                        <div key={`${path}.${idx}`} className="flex gap-2">
                            <input
                                value={item ?? ""}
                                onChange={(e) => {
                                    const next = [...arr];
                                    next[idx] = e.target.value;
                                    onChange(path, next);
                                }}
                                className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-slate-500"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const next = arr.filter((_, i) => i !== idx);
                                    onChange(path, next);
                                }}
                                className="px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/20 text-red-200 font-semibold"
                            >
                                Supprimer
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => onChange(path, [...arr, ""])}
                        className="px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-slate-200 font-semibold hover:bg-slate-700/60"
                    >
                        Ajouter
                    </button>
                </div>
            </div>
        );
    }

    if (field.type === "object" && field.schema && isObject(field.schema)) {
        return (
            <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="text-sm font-semibold text-slate-100">
                    {field.label || path}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(field.schema).map(([k, subField]) => {
                        const subPath = `${path}.${k}`;
                        const subValue = getByPath(value || {}, k);
                        return (
                            <FieldRenderer
                                key={subPath}
                                field={subField}
                                path={subPath}
                                value={subValue}
                                onChange={(p, v) => {
                                    const localKey = p.split(".").slice(-1)[0];
                                    const nextObj = setByPath(value || {}, localKey, v);
                                    onChange(path, nextObj);
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    // Fallback
    return null;
}

export default function CompanyModuleSettingsForm({ settings, onUpdate }) {
    const form = settings?.settingsForms;
    const schema = form?.fields?.settings?.schema || {};
    const defaults = form?.defaults?.settings || {};
    const initialResolved = settings?.settingsResolved?.settings || {};

    const [draft, setDraft] = useState(() => initialResolved);
    const [saving, setSaving] = useState(false);

    // Si settings change (reload), on resync
    useMemo(() => {
        setDraft(initialResolved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings?.id]);

    const moduleEntries = Object.entries(schema);

    if (!moduleEntries.length) {
        return (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6">
                <h2 className="text-xl font-bold text-white">Paramètres (modules)</h2>
                <p className="mt-2 text-slate-400">
                    Aucun module ne fournit de paramètres configurables.
                </p>
            </div>
        );
    }

    const handleChange = (path, value) => {
        setDraft((cur) => setByPath(cur, path, value));
    };

    const handleReset = () => {
        setDraft(defaults);
        toast.success("Paramètres réinitialisés (valeurs par défaut).");
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            // On envoie uniquement l’objet settings (namespace par moduleKey)
            const updated = await updateCompanySettingsJson(draft);
            onUpdate?.(updated);
            toast.success("Paramètres enregistrés.");
        } catch (e) {
            toast.error(e?.message || "Erreur lors de l'enregistrement.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 space-y-6">
            <div className="flex items-start justify-between gap-6">
                <div>
                    <h2 className="text-xl font-bold text-white">Paramètres (modules)</h2>
                    <p className="mt-1 text-slate-400">
                        Configurez les paramètres spécifiques aux modules actifs.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-slate-200 font-semibold hover:bg-slate-700/60 disabled:opacity-60"
                    >
                        Réinitialiser
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 font-semibold hover:bg-indigo-600/40 disabled:opacity-60"
                    >
                        {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </div>
            </div>

            {saving && (
                <div className="flex items-center gap-3 text-slate-300">
                    <Spinner />
                    <span>Enregistrement en cours…</span>
                </div>
            )}

            <div className="space-y-6">
                {moduleEntries.map(([moduleKey, moduleField]) => {
                    const moduleLabel = moduleField?.label || moduleKey;
                    const moduleValue = draft?.[moduleKey] ?? defaults?.[moduleKey] ?? {};

                    // moduleField est un object wrapper {type, label, schema}
                    // On rend directement son schema comme un bloc
                    return (
                        <div key={moduleKey} className="rounded-xl border border-white/10 bg-slate-950/30 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-lg font-bold text-white">{moduleLabel}</div>
                                    <div className="text-xs text-slate-500">Clé: {moduleKey}</div>
                                </div>
                            </div>

                            {/* Render module schema */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {Object.entries(moduleField.schema || {}).map(([k, fieldDef]) => {
                                    const path = `${moduleKey}.${k}`;
                                    const value = moduleValue?.[k];
                                    return (
                                        <FieldRenderer
                                            key={path}
                                            field={fieldDef}
                                            path={path}
                                            value={value}
                                            onChange={(p, v) => handleChange(p, v)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
