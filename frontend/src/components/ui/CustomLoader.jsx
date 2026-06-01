// frontend/src/components/ui/CustomLoader.jsx

import React from 'react';

const CustomLoader = ({ text }) => {
    return (
        <div className="w-full max-w-md text-center">
            <p className="text-lg text-slate-300 mb-4">{text}</p>
            <div className="relative h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                {/* Le caillou animé */}
                <div className="absolute top-0 left-0 h-full w-1/12">
                    <div className="absolute -top-1 w-4 h-4 bg-slate-400 rounded-full animate-pebble-roll"></div>
                </div>
            </div>
        </div>
    );
};

export default CustomLoader;