'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProvider, useUser } from '@/src/lib/UserContext';

const TABS = [
  { href: '/plan', label: 'Planner' },
  { href: '/scenarios', label: 'Compare' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/social-security', label: 'Social Security' },
  { href: '/roth', label: 'Roth' },
  { href: '/medicare', label: 'Medicare' },
  { href: '/profile', label: 'My info' },
];

function Header() {
  const { user, logout } = useUser();
  const pathname = usePathname();
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';

  return (
    <header className="border-b border-white/10">
      {/* Title section: app name, who's signed in, and sign out */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🪺 Retirement Planner
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="opacity-80">{fullName || 'Signed in'}</span>
              <button
                onClick={() => void logout()}
                className="rounded-md border border-white/15 px-3 py-1 hover:bg-white/10"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="underline underline-offset-4">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <nav className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-2 text-sm">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 transition-colors ${
                  active
                    ? 'border-cyan-400 font-medium text-cyan-300'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
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
