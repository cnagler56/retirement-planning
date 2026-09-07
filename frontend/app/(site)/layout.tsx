'use client';

import Link from 'next/link';
import { UserProvider, useUser } from '@/src/lib/UserContext';

function Header() {
  const { user, logout } = useUser();
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          🪺 Retirement Planner
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/plan" className="opacity-80 hover:opacity-100">
            Planner
          </Link>
          <Link href="/social-security" className="opacity-80 hover:opacity-100">
            Social Security
          </Link>
          <Link href="/roth" className="opacity-80 hover:opacity-100">
            Roth
          </Link>
          {user ? (
            <>
              <span className="opacity-70">{user.firstName || user.email}</span>
              <button onClick={() => void logout()} className="underline underline-offset-4">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </UserProvider>
  );
}
