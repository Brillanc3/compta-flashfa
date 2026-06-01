// src/components/Logo.jsx

import React from "react";

import logoOpen from "@/assets/branding/CCA_stat.svg";
import logoClosed from "@/assets/branding/CCA_Blue_Stat.svg";
import logoLoading from "@/assets/branding/CCA_Blue_animated.svg";

/**
 * Logo CCA
 *
 * Variants:
 * - open: sidebar ouverte
 * - closed: sidebar fermée (collapsed)
 * - loading: état de chargement
 */
const Logo = ({ variant = "open", className = "h-8 w-auto", alt = "CCA" }) => {
    const src =
        variant === "loading"
            ? logoLoading
            : variant === "closed"
                ? logoClosed
                : logoOpen;

    return (
        <img
            src={src}
            alt={alt}
            className={`custom-logo-override ${className}`}
            draggable={false}
            loading="eager"
        />
    );
};

export default Logo;