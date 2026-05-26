import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth(true);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: 'var(--ink-3)' }}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin opacity-50" />
          Loading…
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile || { email: user.email || '' }} />
      <main
        className="flex-1 flex flex-col min-w-0"
        style={{ paddingTop: isDesktop ? 0 : 58 }}
      >
        {children}
      </main>
    </div>
  );
}
