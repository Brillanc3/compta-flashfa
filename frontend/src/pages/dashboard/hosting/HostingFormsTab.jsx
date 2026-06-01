import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  listForms, createForm, updateForm, deleteForm,
  addField, updateField, deleteField,
  listResponses, markResponseRead, deleteResponse,
  getForm,
} from '@/services/hostingService';
import { queryClient } from '@/utils/queryClient';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'EMAIL', 'NUMBER', 'BOOLEAN', 'SELECT', 'RADIO', 'DATE'];
const NOTIF_KINDS = ['TEMPORARY', 'PERMANENT', 'BLOCKING'];
const NOTIF_LABELS = { TEMPORARY: 'Temporaire', PERMANENT: 'Permanente', BLOCKING: 'Bloquante' };

function fieldTypeLabel(t) {
  return { TEXT: 'Texte', TEXTAREA: 'Paragraphe', EMAIL: 'Email', NUMBER: 'Nombre', BOOLEAN: 'Oui/Non', SELECT: 'Liste', RADIO: 'Choix unique', DATE: 'Date' }[t] ?? t;
}

// ─── Formulaire de création/édition de champ ─────────────

function FieldEditor({ siteId, formId, field, onDone }) {
  const isNew = !field;
  const [key, setKey] = useState(field?.key ?? '');
  const [label, setLabel] = useState(field?.label ?? '');
  const [type, setType] = useState(field?.type ?? 'TEXT');
  const [required, setRequired] = useState(field?.required ?? false);
  const [optionsRaw, setOptionsRaw] = useState(Array.isArray(field?.options) ? field.options.join('\n') : '');

  const needsOptions = ['SELECT', 'RADIO'].includes(type);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        key: key.trim(),
        label: label.trim(),
        type,
        required,
        options: needsOptions ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : null,
      };
      return isNew
        ? addField(siteId, formId, payload)
        : updateField(siteId, formId, field.id, payload);
    },
    onSuccess: () => {
      toast.success(isNew ? 'Champ ajouté' : 'Champ modifié');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'form', siteId, formId] });
      onDone();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Clé (identifiant)</label>
          <input value={key} onChange={e => setKey(e.target.value)} placeholder="nom_complet"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Label affiché</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom complet"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500">
            {FIELD_TYPES.map(t => <option key={t} value={t}>{fieldTypeLabel(t)}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="accent-indigo-500" />
            Requis
          </label>
        </div>
      </div>
      {needsOptions && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Options (une par ligne)</label>
          <textarea value={optionsRaw} onChange={e => setOptionsRaw(e.target.value)} rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            placeholder={"Option A\nOption B\nOption C"} />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !key.trim() || !label.trim()}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium">
          {isNew ? 'Ajouter' : 'Enregistrer'}
        </button>
        <button onClick={onDone} className="text-sm text-slate-400 hover:text-white">Annuler</button>
      </div>
    </div>
  );
}

// ─── Vue détail d'un formulaire ──────────────────────────

function FormDetail({ siteId, formId, onBack }) {
  const { confirmAction } = useConfirmation();
  const [addingField, setAddingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [showResponses, setShowResponses] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  const { data: form, isLoading } = useQuery({
    queryKey: ['hosting', 'form', siteId, formId],
    queryFn: () => getForm(siteId, formId),
  });

  const { data: responses } = useQuery({
    queryKey: ['hosting', 'responses', siteId, formId],
    queryFn: () => listResponses(siteId, formId),
    enabled: showResponses,
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId) => deleteField(siteId, formId, fieldId),
    onSuccess: () => { toast.success('Champ supprimé'); queryClient.invalidateQueries({ queryKey: ['hosting', 'form', siteId, formId] }); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () => updateForm(siteId, formId, settings),
    onSuccess: () => { toast.success('Paramètres enregistrés'); setEditingSettings(false); queryClient.invalidateQueries({ queryKey: ['hosting', 'form', siteId, formId] }); queryClient.invalidateQueries({ queryKey: ['hosting', 'forms', siteId] }); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const markReadMutation = useMutation({
    mutationFn: ({ responseId, isRead }) => markResponseRead(siteId, formId, responseId, isRead),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hosting', 'responses', siteId, formId] }),
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: (responseId) => deleteResponse(siteId, formId, responseId),
    onSuccess: () => { toast.success('Réponse supprimée'); queryClient.invalidateQueries({ queryKey: ['hosting', 'responses', siteId, formId] }); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  if (isLoading) return <p className="text-slate-400 text-sm">Chargement...</p>;
  if (!form) return null;

  function startEditSettings() {
    setSettings({
      name: form.name,
      description: form.description ?? '',
      isActive: form.isActive,
      opensAt: form.opensAt ? form.opensAt.slice(0, 16) : '',
      closesAt: form.closesAt ? form.closesAt.slice(0, 16) : '',
      maxResponses: form.maxResponses ?? '',
      notifKind: form.notifKind,
      notifTitle: form.notifTitle ?? '',
      notifMessage: form.notifMessage,
      notifDurationSec: form.notifDurationSec,
      discordWebhookUrl: form.discordWebhookUrl ?? '',
    });
    setEditingSettings(true);
  }

  const unread = Array.isArray(responses) ? responses.filter(r => !r.isRead).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm">← Retour</button>
        <span className="text-white font-medium">{form.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${form.isActive ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>{form.isActive ? 'Actif' : 'Inactif'}</span>
        <button onClick={startEditSettings} className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-2 py-1 rounded">Paramètres</button>
        <button onClick={() => setShowResponses(s => !s)} className={`text-xs px-2 py-1 rounded border transition-colors ${showResponses ? 'border-violet-600 text-violet-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
          Réponses {unread > 0 && <span className="ml-1 bg-red-600 text-white rounded-full text-[10px] px-1">{unread}</span>}
        </button>
      </div>

      {editingSettings && settings && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-white mb-3">Paramètres du formulaire</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom *</label>
              <input value={settings.name} onChange={e => setSettings(s => ({...s, name: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={settings.isActive} onChange={e => setSettings(s => ({...s, isActive: e.target.checked}))} className="accent-indigo-500" />
                Actif
              </label>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ouvre le</label>
              <input type="datetime-local" value={settings.opensAt} onChange={e => setSettings(s => ({...s, opensAt: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ferme le</label>
              <input type="datetime-local" value={settings.closesAt} onChange={e => setSettings(s => ({...s, closesAt: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max réponses</label>
              <input type="number" min={1} value={settings.maxResponses} onChange={e => setSettings(s => ({...s, maxResponses: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Illimité" />
            </div>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs font-medium text-slate-300 mb-2">Notification après soumission</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <select value={settings.notifKind} onChange={e => setSettings(s => ({...s, notifKind: e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {NOTIF_KINDS.map(k => <option key={k} value={k}>{NOTIF_LABELS[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Titre (optionnel)</label>
                <input value={settings.notifTitle} onChange={e => setSettings(s => ({...s, notifTitle: e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Envoyé !" />
              </div>
              {settings.notifKind === 'TEMPORARY' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Durée (sec)</label>
                  <input type="number" min={1} max={60} value={settings.notifDurationSec} onChange={e => setSettings(s => ({...s, notifDurationSec: Number(e.target.value)}))}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              )}
            </div>
            <div className="mt-2">
              <label className="block text-xs text-slate-400 mb-1">Message</label>
              <input value={settings.notifMessage} onChange={e => setSettings(s => ({...s, notifMessage: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Discord webhook (notifications admin)</label>
            <input value={settings.discordWebhookUrl} onChange={e => setSettings(s => ({...s, discordWebhookUrl: e.target.value}))}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500" placeholder="https://discord.com/api/webhooks/..." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => updateSettingsMutation.mutate()} disabled={updateSettingsMutation.isPending}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium">
              Enregistrer
            </button>
            <button onClick={() => setEditingSettings(false)} className="text-sm text-slate-400 hover:text-white">Annuler</button>
          </div>
        </div>
      )}

      {showResponses ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{Array.isArray(responses) ? responses.length : 0} réponse(s)</p>
          {(responses || []).map((r) => (
            <div key={r.id} className={`border rounded-lg p-3 space-y-2 ${r.isRead ? 'border-slate-700 bg-slate-900/30' : 'border-indigo-800 bg-indigo-950/20'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString('fr-FR')}</span>
                {!r.isRead && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">Nouveau</span>}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => markReadMutation.mutate({ responseId: r.id, isRead: !r.isRead })}
                    className="text-xs text-slate-400 hover:text-white">{r.isRead ? 'Marquer non lu' : 'Marquer lu'}</button>
                  <button onClick={() => confirmAction({ title: 'Supprimer la réponse ?', message: 'Action irréversible.', onConfirm: () => deleteResponseMutation.mutate(r.id) })}
                    className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {form.fields.map(f => (
                  <div key={f.id} className="text-xs">
                    <span className="text-slate-400">{f.label}: </span>
                    <span className="text-white">{String(r.data[f.key] ?? '—')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(!responses || responses.length === 0) && <p className="text-slate-500 text-sm">Aucune réponse.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 mb-1">{form.fields.length} champ(s)</p>
          {form.fields.map((f) => (
            <div key={f.id} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 flex items-center gap-3">
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">{fieldTypeLabel(f.type)}</span>
              <span className="text-sm text-white flex-1">{f.label}</span>
              <code className="text-xs text-slate-400 font-mono">{f.key}</code>
              {f.required && <span className="text-xs text-amber-400">*</span>}
              <div className="flex gap-2">
                <button onClick={() => setEditingFieldId(f.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Éditer</button>
                <button onClick={() => confirmAction({ title: 'Supprimer le champ', message: `Supprimer "${f.label}" ?`, onConfirm: () => deleteFieldMutation.mutate(f.id) })}
                  className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
              </div>
            </div>
          ))}
          {editingFieldId && (
            <FieldEditor siteId={siteId} formId={formId}
              field={form.fields.find(f => f.id === editingFieldId)}
              onDone={() => setEditingFieldId(null)} />
          )}
          {!editingFieldId && !addingField && (
            <button onClick={() => setAddingField(true)}
              className="px-3 py-1.5 rounded border border-dashed border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 text-sm transition-colors">
              + Ajouter un champ
            </button>
          )}
          {addingField && <FieldEditor siteId={siteId} formId={formId} onDone={() => setAddingField(false)} />}
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">Intégration dans votre site</p>
        <p>Récupérer le formulaire :</p>
        <code className="block text-green-400">{`fetch('/api/hosting/public/SLUG/forms/${formId}')`}</code>
        <p>Soumettre :</p>
        <code className="block text-green-400">{`fetch('/api/hosting/public/SLUG/forms/${formId}/submit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })`}</code>
      </div>
    </div>
  );
}

// ─── Liste des formulaires ───────────────────────────────

export default function HostingFormsTab({ siteId }) {
  const { confirmAction } = useConfirmation();
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: forms, isLoading } = useQuery({
    queryKey: ['hosting', 'forms', siteId],
    queryFn: () => listForms(siteId),
  });

  const createMutation = useMutation({
    mutationFn: () => createForm(siteId, { name: newName.trim() }),
    onSuccess: (form) => {
      toast.success('Formulaire créé');
      setShowCreate(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['hosting', 'forms', siteId] });
      setSelectedFormId(form.id);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (formId) => deleteForm(siteId, formId),
    onSuccess: () => { toast.success('Formulaire supprimé'); queryClient.invalidateQueries({ queryKey: ['hosting', 'forms', siteId] }); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  if (selectedFormId) {
    return <FormDetail siteId={siteId} formId={selectedFormId} onBack={() => setSelectedFormId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{(forms || []).length}/50 formulaires</p>
        {(forms || []).length < 50 && (
          <button onClick={() => setShowCreate(s => !s)}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
            + Nouveau formulaire
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Nom du formulaire</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Formulaire de contact"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newName.trim()}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium">
            Créer
          </button>
          <button onClick={() => setShowCreate(false)} className="text-sm text-slate-400 hover:text-white">Annuler</button>
        </div>
      )}

      {isLoading && <p className="text-slate-400 text-sm">Chargement...</p>}
      {(forms || []).length === 0 && !isLoading && (
        <p className="text-slate-500 text-sm">Aucun formulaire. Créez-en un pour commencer.</p>
      )}
      <div className="space-y-2">
        {(forms || []).map((form) => (
          <div key={form.id} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{form.name}</p>
              <p className="text-xs text-slate-400">
                {form._count.fields} champ(s) · {form._count.responses} réponse(s)
                {form.closesAt && ` · Ferme ${new Date(form.closesAt).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${form.isActive ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
              {form.isActive ? 'Actif' : 'Inactif'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setSelectedFormId(form.id)} className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-2 py-1 rounded">
                Gérer
              </button>
              <button onClick={() => confirmAction({ title: 'Supprimer le formulaire', message: `Supprimer "${form.name}" et toutes ses réponses ?`, onConfirm: () => deleteMutation.mutate(form.id) })}
                className="text-xs text-red-400 hover:text-red-300">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
