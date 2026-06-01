// frontend/src/components/ui/Spinner.jsx

import React from 'react';
import Logo from "@/components/Logo.jsx";
/**
 * Affiche une icône de chargement animée.
 */
const Spinner = () => {
    return (
        <Logo
            variant={"loading"}
            alt={"Chargement en cours..."}
        />
    );
};

export default Spinner;