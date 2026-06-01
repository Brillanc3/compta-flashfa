// /frontend/src/components/ui/button.jsx

import React from 'react';
import clsx from 'clsx';

/**
 * Bouton universel stylisé (compatible Tailwind)
 * Utilisé dans tout le projet (dashboard, formulaires, tables...)
 *
 * Props :
 * - variant : "primary" | "secondary" | "danger" | "success" | "ghost"
 * - size : "sm" | "md" | "lg"
 * - className : classes supplémentaires
 */
export const Button = ({
                           children,
                           onClick,
                           type = 'button',
                           disabled = false,
                           variant = 'primary',
                           size = 'md',
                           className = '',
                       }) => {
    const baseStyles =
        'inline-flex items-center justify-center font-medium rounded-md focus:outline-none transition';

    const variantStyles = {
        primary: 'bg-brand-primary hover:bg-brand-dark text-white shadow-sm hover:shadow-md active:scale-95',
        secondary: 'bg-cca-surface border border-cca-border hover:bg-cca-base text-cca-textPrimary active:scale-95',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-95',
        success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm active:scale-95',
        ghost: 'bg-transparent hover:bg-cca-surface text-cca-textSecondary hover:text-cca-textPrimary active:scale-95',
    };

    const sizeStyles = {
        sm: 'px-2 py-1 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-3 text-base',
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                baseStyles,
                variantStyles[variant],
                sizeStyles[size],
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            {children}
        </button>
    );
};

export default Button;
