// frontend/src/components/dashboard/profile/ChangePasswordForm.jsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { changePassword } from '@/services/userService.js';

const ChangePasswordForm = () => {
    const [form, setForm] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
            toast.error('Veuillez remplir tous les champs.');
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            toast.error('Les nouveaux mots de passe ne correspondent pas.');
            return;
        }
        if (form.newPassword.length < 8) {
            toast.error('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        setLoading(true);
        try {
            await changePassword(form.oldPassword, form.newPassword);
            toast.success('Mot de passe mis à jour avec succès.');
            setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(err.message || "Erreur lors du changement de mot de passe.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-cca-surface border border-cca-border rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-cca-textPrimary border-b border-cca-border pb-3 mb-4">
                Sécurité du compte
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-cca-textSecondary text-sm mb-1">Mot de passe actuel</label>
                    <input
                        type="password"
                        name="oldPassword"
                        value={form.oldPassword}
                        onChange={handleChange}
                        className="w-full p-2 rounded bg-cca-base text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        placeholder="********"
                    />
                </div>

                <div>
                    <label className="block text-cca-textSecondary text-sm mb-1">Nouveau mot de passe</label>
                    <input
                        type="password"
                        name="newPassword"
                        value={form.newPassword}
                        onChange={handleChange}
                        className="w-full p-2 rounded bg-cca-base text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        placeholder="********"
                    />
                </div>

                <div>
                    <label className="block text-cca-textSecondary text-sm mb-1">Confirmer le nouveau mot de passe</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        className="w-full p-2 rounded bg-cca-base text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        placeholder="********"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition disabled:opacity-50"
                >
                    {loading ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
            </form>
        </div>
    );
};

export default ChangePasswordForm;
