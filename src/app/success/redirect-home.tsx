'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Returns the kiosk to the wizard after `seconds`. */
export function RedirectHome({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), seconds * 1000);
    return () => clearTimeout(t);
  }, [router, seconds]);
  return null;
}
