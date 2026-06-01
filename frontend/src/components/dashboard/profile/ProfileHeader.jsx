// frontend/src/components/dashboard/profile/ProfileHeader.jsx

import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { uploadProfilePicture } from '../../../services/userService';
import EditIcon from '@mui/icons-material/Edit';

const ProfileHeader = ({ user, onPictureUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    // Le ref nous permet de déclencher le clic sur l'input de fichier sans l'afficher
    const fileInputRef = useRef(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // On vérifie la taille du fichier côté client pour une meilleure UX
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Le fichier est trop volumineux (5Mo maximum).");
            return;
        }

        setIsUploading(true);
        try {
            await uploadProfilePicture(file);
            toast.success("Image de profil mise à jour !");
            // On appelle la fonction passée en prop pour rafraîchir les données de l'utilisateur
            onPictureUpdate();
        } catch (error) {
            toast.error(error.message || "Échec de la mise à jour de l'image.");
        } finally {
            setIsUploading(false);
            // On réinitialise l'input pour pouvoir sélectionner le même fichier à nouveau
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // On déclenche le clic sur l'input caché
    const handleEditClick = () => {
        fileInputRef.current.click();
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // On construit l'URL complète de l'image
    const imageUrl = user.imageUrl ? `${user.imageUrl}` : null;

    return (
        <div className="bg-cca-surface border border-cca-border rounded-lg shadow-md p-6 flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8">
            <div className="relative group shrink-0">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Avatar"
                        className="h-28 w-28 rounded-full object-cover border-4 border-cca-base shadow-lg"
                    />
                ) : (
                    <div className="h-28 w-28 rounded-full bg-cca-base flex items-center justify-center border-4 border-cca-border shadow-lg">
                        <span className="text-4xl font-bold text-cca-textPrimary">{getInitials(user.name)}</span>
                    </div>
                )}
                {/* Overlay pour l'édition qui apparaît au survol */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleEditClick}
                        disabled={isUploading}
                        className="text-white p-2 rounded-full hover:bg-black/50"
                    >
                        {isUploading ? (
                            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <EditIcon />
                        )}
                    </button>
                </div>
            </div>

            {/* Input de fichier, caché visuellement */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
            />

            <div className="flex-1 text-center md:text-left flex flex-col justify-center pt-2">
                <h1 className="text-3xl font-bold text-cca-textPrimary mb-1">{user.name}</h1>
                <p className="text-brand-primary font-medium mb-5">@{user.username}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <div className="bg-cca-base/50 border border-cca-border/50 px-4 py-2.5 rounded-xl inline-flex flex-col">
                        <span className="text-cca-textSecondary text-[10px] uppercase tracking-widest font-bold mb-1">Téléphone</span>
                        <span className="text-cca-textPrimary text-sm font-mono font-medium">{user.phoneNumber || <span className="text-cca-textSecondary/60 italic text-xs">Non renseigné</span>}</span>
                    </div>
                    <div className="bg-cca-base/50 border border-cca-border/50 px-4 py-2.5 rounded-xl inline-flex flex-col">
                        <span className="text-cca-textSecondary text-[10px] uppercase tracking-widest font-bold mb-1">IBAN</span>
                        <span className="text-cca-textPrimary text-sm font-mono font-medium">{user.iban || <span className="text-cca-textSecondary/60 italic text-xs">Non renseigné</span>}</span>
                    </div>
                    {user.discordId && (
                        <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 px-4 py-2.5 rounded-xl inline-flex flex-col">
                            <span className="text-[#5865F2] text-[10px] uppercase tracking-widest font-bold mb-1">Discord ID</span>
                            <span className="text-cca-textPrimary text-sm font-mono font-medium">{user.discordId}</span>
                        </div>
                    )}
                    {user.characterId && (
                        <div className="bg-cca-base/50 border border-cca-border/50 px-4 py-2.5 rounded-xl inline-flex flex-col">
                            <span className="text-cca-textSecondary text-[10px] uppercase tracking-widest font-bold mb-1">NNI</span>
                            <span className="text-cca-textPrimary text-sm font-mono font-medium">#{user.characterId}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

ProfileHeader.propTypes = {
    user: PropTypes.object.isRequired,
    onPictureUpdate: PropTypes.func.isRequired,
};

export default ProfileHeader;