// frontend/src/components/Navbar.jsx

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
    const { isAuthenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    // Ferme le menu mobile à chaque navigation
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname, location.hash]);

    return (
        <nav className="bg-cca-base shadow-sm sticky top-0 z-50 border-b border-cca-border transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-3">
                    <div className="flex items-center min-w-0">
                        <Link to="/" className="flex-shrink-0 flex items-center text-cca-textPrimary min-w-0 font-heading">
                            <Logo className="h-8 w-auto text-brand-primary shrink-0 transition-transform duration-300 hover:scale-110" />
                            {/* Desktop */}
                            <span className="ml-3 text-xl font-bold hidden sm:block truncate">
                                Caillou&apos;s Clarity Accounting
                            </span>
                        </Link>
                    </div>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex items-baseline space-x-2">
                            <a
                                href="/#features"
                                className="text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary px-3 py-2 rounded-md text-sm font-medium transition-all duration-200"
                            >
                                Fonctionnalités
                            </a>
                            <a
                                href="/#pricing"
                                className="text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary px-3 py-2 rounded-md text-sm font-medium transition-all duration-200"
                            >
                                Tarifs
                            </a>
                        </div>

                        <div>
                            {isAuthenticated ? (
                                <Link
                                    to="/dashboard"
                                    className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-6 rounded-md text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    Accéder à mon espace
                                </Link>
                            ) : (
                                <Link
                                    to="/login"
                                    className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-6 rounded-md text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
                                >
                                    Connexion
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Mobile actions */}
                    <div className="md:hidden flex items-center gap-2">
                        {isAuthenticated ? (
                            <Link
                                to="/dashboard"
                                className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-md text-xs transition-all duration-300 whitespace-nowrap active:scale-95 shadow-sm"
                            >
                                Mon espace
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-md text-xs transition-all duration-300 whitespace-nowrap active:scale-95 shadow-sm"
                            >
                                Connexion
                            </Link>
                        )}

                        <button
                            type="button"
                            aria-label="Ouvrir le menu"
                            aria-expanded={isOpen}
                            className="p-2 rounded-md hover:bg-cca-surface text-cca-textSecondary hover:text-cca-textPrimary transition-all duration-200"
                            onClick={() => setIsOpen((v) => !v)}
                        >
                            {/* Hamburger */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu panel */}
            {isOpen && (
                <div className="md:hidden border-t border-cca-border bg-cca-base animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 space-y-2">
                        <a
                            href="/#features"
                            className="block w-full text-left text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary px-3 py-2 rounded-md text-sm font-medium transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            Fonctionnalités
                        </a>
                        <a
                            href="/#pricing"
                            className="block w-full text-left text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary px-3 py-2 rounded-md text-sm font-medium transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            Tarifs
                        </a>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
