// frontend/src/pages/dashboard/customization/CustomizationPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { Upload, Save, RefreshCw, Layers } from 'lucide-react';
import api from '@/services/api';

const CUSTOMIZATION_VARIABLES = [
    { key: 'brand-primary', label: 'Couleur Principale', defaultHex: '#54749E' },
    { key: 'brand-light', label: 'Couleur Claire (Hover)', defaultHex: '#8AA4C4' },
    { key: 'brand-dark', label: 'Couleur Sombre (Active)', defaultHex: '#354F73' },
    { key: 'bg-base', label: 'Fond Principal', defaultHex: '#020617' },
    { key: 'bg-surface', label: 'Fond Panneaux/Cartes', defaultHex: '#0f172a' },
    { key: 'border-color', label: 'Bordures', defaultHex: '#334155' },
    { key: 'text-primary', label: 'Texte Principal', defaultHex: '#F8FAFC' },
    { key: 'text-secondary', label: 'Texte Secondaire', defaultHex: '#94A3B8' },
];

export default function CustomizationPage() {
    const { activeCompanyId } = useCompany();
    
    const [themeConfig, setThemeConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [imageFiles, setImageFiles] = useState({ loading: null, banner: null, icon: null });
    const [uploadingImage, setUploadingImage] = useState({ loading: false, banner: false, icon: false });

    const fetchConfig = useCallback(async () => {
        if (!activeCompanyId) return;
        try {
            setLoading(true);
            const { data } = await api.get(`/customization/${activeCompanyId}`);
            setThemeConfig(data.customTheme || {});
        } catch (error) {
            console.error(error);
            toast.error("Impossible de charger la personnalisation.");
        } finally {
            setLoading(false);
        }
    }, [activeCompanyId]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleColorChange = (key, hex) => {
        setThemeConfig(prev => ({ ...prev, [key]: hex }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put(`/customization/${activeCompanyId}`, { customTheme: themeConfig });
            toast.success("Thème sauvegardé avec succès !");
            // Le CompanyContext va détecter le changement si on recharge la page
            // ou on peut recharger explicitement
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la sauvegarde du thème.");
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e, imageType) => {
        e.preventDefault();
        const file = imageFiles[imageType];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploadingImage(prev => ({ ...prev, [imageType]: true }));
            const { data } = await api.post(`/customization/${activeCompanyId}/image/${imageType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const themeKeyMap = { loading: 'loadingUrl', banner: 'bannerUrl', icon: 'iconUrl' };
            toast.success("Image mise à jour !");
            setThemeConfig(prev => ({ ...prev, [themeKeyMap[imageType]]: data.imageUrl }));
            setImageFiles(prev => ({ ...prev, [imageType]: null }));
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'envoi de l'image.");
        } finally {
            setUploadingImage(prev => ({ ...prev, [imageType]: false }));
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
            <div className="flex items-center space-x-4 pb-6 border-b border-cca-border">
                <div className="p-3 bg-cca-brand/20 rounded-xl">
                    <Layers className="w-8 h-8 text-cca-brand" />
                </div>
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white">Personnalisation (Marque Blanche)</h1>
                    <p className="text-slate-400 mt-1">
                        Configurez les couleurs et le logo spécifiques à votre entreprise. Ces paramètres écraseront l'apparence par défaut.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Couleurs */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cca-brand/5 blur-3xl -z-10 rounded-full mix-blend-screen pointer-events-none" />
                        
                        <h2 className="text-xl font-bold text-white mb-6">Palette de Couleurs</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {CUSTOMIZATION_VARIABLES.map(item => {
                                const currentColor = themeConfig[item.key] || item.defaultHex;
                                return (
                                    <div key={item.key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-200">
                                                {item.label}
                                            </label>
                                            <p className="text-xs text-slate-500 font-mono">--{item.key}</p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-xs text-slate-400 uppercase w-16 text-right">
                                                {currentColor}
                                            </span>
                                            <input
                                                type="color"
                                                value={currentColor}
                                                onChange={(e) => handleColorChange(item.key, e.target.value)}
                                                className="w-10 h-10 p-1 bg-slate-800 rounded cursor-pointer border-cca-border focus:ring-2 focus:ring-cca-brand"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex justify-end items-center space-x-4">
                            <button
                                onClick={() => setThemeConfig(prev => ({ ...prev, logoUrl: prev.logoUrl }))} // Reset logic could actually empty these keys
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Réinitialiser
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center px-6 py-2 bg-cca-brand hover:bg-cca-brand-light text-white rounded-lg font-medium transition-colors shadow-lg shadow-cca-brand/20 disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                                Enregistrer le thème
                            </button>
                        </div>
                    </div>
                </div>

                {/* Images de thème */}
                <div className="space-y-4">
                    {[
                        { key: 'loading', label: 'Loading',  hint: 'Écran de chargement (400×400)', urlKey: 'loadingUrl' },
                        { key: 'banner',  label: 'Bannière', hint: 'Nav ouverte (240×80)',           urlKey: 'bannerUrl'  },
                        { key: 'icon',    label: 'Icône',    hint: 'Nav fermée (64×64)',             urlKey: 'iconUrl'    },
                    ].map(({ key, label, hint, urlKey }) => (
                        <div key={key} className="glass-panel p-5 rounded-xl">
                            <h3 className="text-base font-bold text-white mb-4">{label}</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-20 h-20 bg-slate-900/80 rounded-lg border border-dashed border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                    {themeConfig[urlKey] ? (
                                        <img src={themeConfig[urlKey]} alt={label} className="max-w-full max-h-full object-contain p-2" />
                                    ) : (
                                        <span className="text-xs text-slate-600">Vide</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">{hint}<br />SVG ou PNG → WebP</p>
                            </div>
                            <form onSubmit={(e) => handleImageUpload(e, key)} className="space-y-3">
                                <input
                                    type="file"
                                    accept="image/svg+xml, image/png"
                                    onChange={(e) => setImageFiles(prev => ({ ...prev, [key]: e.target.files[0] }))}
                                    className="w-full text-sm text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                                />
                                <button
                                    type="submit"
                                    disabled={!imageFiles[key] || uploadingImage[key]}
                                    className="w-full flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploadingImage[key] ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                    Uploader
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
