import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ChatImagePreviewModal({ attachments, currentIndex, onClose, onPrev, onNext }) {
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };
        document.addEventListener('keydown', onKeyDown);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prev;
        };
    }, [onClose, onNext, onPrev]);

    if (!attachments?.length) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute top-6 right-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all hover:scale-110 text-white/80 hover:text-white"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={e => e.stopPropagation()}>
                {attachments.length > 1 && (
                    <button onClick={onPrev} className="absolute left-4 md:left-10 z-10 p-3 rounded-full bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-all shadow-xl" aria-label="Image précédente">
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                )}

                <div className="relative flex flex-col items-center gap-4 max-w-full max-h-full">
                    <img
                        src={attachments[currentIndex].url}
                        alt={attachments[currentIndex].publicId || 'Image'}
                        className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm select-none animate-in zoom-in-95 duration-200"
                        draggable={false}
                    />
                    {attachments.length > 1 && (
                        <div className="text-[11px] text-white/30 font-medium tracking-wider">
                            {currentIndex + 1} / {attachments.length}
                        </div>
                    )}
                </div>

                {attachments.length > 1 && (
                    <button onClick={onNext} className="absolute right-4 md:right-10 z-10 p-3 rounded-full bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-all shadow-xl" aria-label="Image suivante">
                        <ChevronRight className="w-8 h-8" />
                    </button>
                )}
            </div>
        </div>
    );
}
