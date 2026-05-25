'use client';

import type { Group } from '@/lib/catalog';
import type { Lang } from '@/lib/i18n';

interface ProductGroupHeaderProps {
  group: Group;
  lang: Lang;
}

export function ProductGroupHeader({ group, lang }: ProductGroupHeaderProps) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <h2 className="text-lg font-bold text-gray-900">
        {group.label.it}
        <span className="ml-2 font-normal text-gray-500">
          {group.label.en}
        </span>
      </h2>
      {group.note && (
        <p className="mt-0.5 text-sm text-gray-500">
          {group.note[lang]}
        </p>
      )}
    </div>
  );
}
