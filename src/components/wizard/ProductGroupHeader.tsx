'use client';

import type { Group } from '@/lib/catalog';

interface IncludedNote {
  it: string;
  en: string;
}

interface ProductGroupHeaderProps {
  group: Group;
  includedNote?: IncludedNote;
}

export function ProductGroupHeader({ group, includedNote }: ProductGroupHeaderProps) {
  return (
    <div className="mb-3 mt-10 first:mt-0">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold tracking-[0.2em] text-black flex items-center gap-2">
          {group.label.it.toUpperCase()}
          {includedNote && (
            <span className="font-normal tracking-normal not-italic text-sm text-gray-600">
              — {includedNote.it}
            </span>
          )}
        </h2>
        <div className="text-right">
          <span className="text-sm text-gray-400">
            {group.label.en}
          </span>
          {includedNote && (
            <div className="text-sm italic text-gray-400">
              {includedNote.en}
            </div>
          )}
        </div>
      </div>
      {group.note && (
        <p className="mt-1 text-xs text-gray-400 italic">
          {group.note.it} / {group.note.en}
        </p>
      )}
    </div>
  );
}
