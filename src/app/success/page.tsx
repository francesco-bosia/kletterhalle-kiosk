'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Inner component that uses useSearchParams — must be wrapped in Suspense.
 */
function SuccessRedirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const total = searchParams.get('total') || '';
    const targetUrl = total
      ? `/?twint_return=true&total=${encodeURIComponent(total)}`
      : '/?twint_return=true';

    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <svg
          className="mx-auto h-8 w-8 animate-spin text-green-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="mt-4 text-lg text-gray-600">
          Pagamento riuscito, reindirizzamento...
          <br />
          Payment successful, redirecting...
        </p>
      </div>
    </div>
  );
}

/**
 * Thin wrapper page that handles TWINT redirect returns.
 *
 * After a TWINT payment, Stripe redirects to /success?total=...
 * This page reads the params and redirects back to the main wizard
 * with twint_return=true so WizardRoot can pick it up.
 */
export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto h-8 w-8 animate-spin text-green-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-600">
              Pagamento riuscito, reindirizzamento...
              <br />
              Payment successful, redirecting...
            </p>
          </div>
        </div>
      }
    >
      <SuccessRedirector />
    </Suspense>
  );
}
