// /frontend/src/components/chat/CommandSuggestions.jsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Helper function to format parameters like Discord
const formatParameters = (parameters) => {
    if (!parameters || parameters.length === 0) {
        return '';
    }
    return parameters.map(p => p.required ? `<${p.name}>` : `[${p.name}]`).join(' ');
};

const CommandSuggestions = ({ suggestions, activeIndex, onSelect, onHoverIndexChange }) => { // Added onHoverIndexChange
    if (!suggestions || suggestions.length === 0) {
        return null;
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 10, scaleY: 0.9 },
        visible: { opacity: 1, y: 0, scaleY: 1, transition: { staggerChildren: 0.05, duration: 0.15 } },
        exit: { opacity: 0, y: 10, scaleY: 0.9, transition: { duration: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -10 }
    };

    return (
        <AnimatePresence>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20"
                style={{ scrollbarWidth: 'thin' }}
            >
                {suggestions.map((suggestion, index) => (
                    <motion.div
                        key={suggestion.command}
                        variants={itemVariants}
                        onClick={() => onSelect(suggestion)} // Passer l'objet suggestion entier
                        onMouseEnter={() => onHoverIndexChange(index)} // Mettre à jour l'index actif au survol
                        className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm ${
                            index === activeIndex ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {/* Afficher la commande avec ses paramètres formatés */}
                        <div className="flex items-baseline">
                            <span className="font-mono font-semibold text-white mr-2">{suggestion.command}</span>
                            <span className="text-xs text-slate-400 font-mono">{formatParameters(suggestion.parameters)}</span>
                        </div>
                        <span className="text-xs text-slate-500 truncate ml-4">{suggestion.description}</span>
                    </motion.div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
};

export default CommandSuggestions;