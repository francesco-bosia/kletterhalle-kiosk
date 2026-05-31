'use client';

import type { Group } from '@/lib/catalog';

interface ProductGroupHeaderProps {
  group: Group;
}

export function ProductGroupHeader({ group }: ProductGroupHeaderProps) {
  const note = group.note;

  return (
    <div className="mb-1 mt-5 first:mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-extrabold tracking-[0.2em] text-black uppercase">
          {group.label.it}
          {note && (
            <span className="ml-2 font-normal tracking-normal normal-case text-sm text-gray-600">
              — {note.it}
            </span>
          )}
        </h2>
        <span className="text-sm italic text-gray-400 shrink-0">
          {group.label.en}
        </span>
      </div>
      {note && (
        <p className="mt-0.5 text-sm italic text-gray-400">
          {group.label.en} — {note.en}
        </p>
      )}
    </div>
  );
}
