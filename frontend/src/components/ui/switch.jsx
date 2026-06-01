// /frontend/src/components/ui/switch.jsx
import React from 'react';
import clsx from 'clsx';

const Switch = ({ checked, onChange, disabled = false }) => {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                checked ? 'bg-green-500' : 'bg-slate-600',
                disabled && 'opacity-50 cursor-not-allowed'
            )}
        >
      <span
          className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              checked ? 'translate-x-6' : 'translate-x-1'
          )}
      />
        </button>
    );
};

export default Switch;
