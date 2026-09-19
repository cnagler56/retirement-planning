'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Accounts now live under My info → Accounts. Redirect any old link there. */
export default function AccountsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/profile?tab=accounts');
  }, [router]);
  return <p className="text-sm opacity-60">Redirecting to your accounts…</p>;
}
