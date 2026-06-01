// /frontend/src/components/ui/Tooltip.jsx

import React from 'react';

const Tooltip = ({ children, text }) => {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute bottom-full mb-2 w-max max-w-xs p-2 text-sm text-white bg-slate-900 border border-slate-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                {text}
            </div>
        </div>
    );
};

export default Tooltip;