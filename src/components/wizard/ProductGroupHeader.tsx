'use client';

import type { Group } from '@/lib/catalog';
import type { Lang } from '@/lib/i18n';

interface ProductGroupHeaderProps {
  group: Group;
  lang: Lang;
}

export function ProductGroupHeader({ group, lang }: ProductGroupHeaderProps) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold tracking-widest text-black">
          {group.label.it.toUpperCase()}
        </h2>
        <span className="text-sm text-gray-400">
          {group.label.en}
        </span>
      </div>
      {group.note && (
        <p className="mt-1 text-xs text-gray-400 italic">
          {group.note.it} / {group.note.en}
        </p>
      )}
    </div>
  );
}
