import React, { useEffect, useRef } from 'react';
import EmojiPicker, { Theme, Categories } from 'emoji-picker-react';

const CATEGORIES = [
    { category: Categories.CUSTOM,         name: 'Serveur' },
    { category: Categories.SUGGESTED,      name: 'Récents' },
    { category: Categories.SMILEYS_PEOPLE, name: 'Smileys' },
    { category: Categories.ANIMALS_NATURE, name: 'Nature' },
    { category: Categories.FOOD_DRINK,     name: 'Nourriture' },
    { category: Categories.TRAVEL_PLACES,  name: 'Voyages' },
    { category: Categories.ACTIVITIES,     name: 'Activités' },
    { category: Categories.OBJECTS,        name: 'Objets' },
    { category: Categories.SYMBOLS,        name: 'Symboles' },
    { category: Categories.FLAGS,          name: 'Drapeaux' },
];

export default function EmojiPickerPopover({ guildEmojis = [], onSelect, onClose }) {
    const wrapRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose?.();
        };
        document.addEventListener('mousedown', handler, true);
        return () => document.removeEventListener('mousedown', handler, true);
    }, [onClose]);

    const customEmojis = guildEmojis.map(e => ({
        id:     String(e.id),
        names:  [e.name],
        imgUrl: e.url,
    }));

    const handleEmojiClick = (emojiData) => {
        if (emojiData.isCustom) {
            const name = emojiData.names?.[0] ?? 'emoji';
            onSelect?.(`<:${name}:${emojiData.emoji}>`);
        } else {
            onSelect?.(emojiData.emoji);
        }
    };

    const pickerWidth = Math.min(352, window.innerWidth - 16);

    return (
        <div ref={wrapRef} className="tv2-emoji-picker-wrap">
            <EmojiPicker
                onEmojiClick={handleEmojiClick}
                customEmojis={customEmojis}
                categories={customEmojis.length > 0 ? CATEGORIES : CATEGORIES.slice(1)}
                theme={Theme.DARK}
                searchPlaceholder="Rechercher un emoji…"
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
                width={pickerWidth}
                height={420}
            />
        </div>
    );
}
