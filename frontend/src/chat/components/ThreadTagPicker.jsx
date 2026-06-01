import React from 'react';
import { Tag, X } from 'lucide-react';

export default function ThreadTagPicker({ tags = [], selected = [], onToggle, max = 5 }) {
    if (!tags.length) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => {
                const isSelected = selected.includes(String(tag.id));
                const atMax = !isSelected && selected.length >= max;
                return (
                    <button
                        key={tag.id}
                        type="button"
                        disabled={atMax}
                        onClick={() => onToggle(String(tag.id))}
                        title={atMax ? `Max ${max} tags` : tag.name}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all
                            ${isSelected
                                ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                                : atMax
                                    ? 'bg-cca-base border-cca-border text-cca-textSecondary opacity-40 cursor-not-allowed'
                                    : 'bg-cca-base border-cca-border text-cca-textSecondary hover:border-brand-primary hover:text-brand-primary'
                            }`}
                    >
                        {tag.emoji && <span>{tag.emoji}</span>}
                        {!tag.emoji && <Tag className="w-2.5 h-2.5" />}
                        {tag.name}
                        {isSelected && <X className="w-2.5 h-2.5 ml-0.5" />}
                    </button>
                );
            })}
        </div>
    );
}

export function TagBadge({ tag }) {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
            {tag.emoji && <span>{tag.emoji}</span>}
            {!tag.emoji && <Tag className="w-2 h-2" />}
            {tag.name}
        </span>
    );
}
