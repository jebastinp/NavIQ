import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutGrid, Route, Upload, Users, BarChart3, LogOut, Menu, X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/orders', label: 'Orders', icon: Upload },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/routes', label: 'Routes', icon: Route },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar({ profile }: {
  profile: { full_name?: string; email: string; company_name?: string } | null;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Detect viewport size so we know whether to show as drawer or static sidebar.
  // Using JS instead of Tailwind responsive classes avoids the inline-style override bug
  // that was hiding the sidebar on desktop.
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  async function signOut() {
    await supabase().auth.signOut();
    router.push('/login');
  }

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [router.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen && !isDesktop ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen, isDesktop]);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : profile?.email?.slice(0, 2).toUpperCase() || '??';

  // Sidebar visibility:
  // - Desktop: always visible (translateX 0)
  // - Mobile: slides in from left when mobileOpen is true
  const sidebarVisible = isDesktop || mobileOpen;

  const NavContent = (
    <>
      <div className="px-4 pt-5 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 no-select">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              boxShadow: '0 4px 12px var(--accent-shadow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>NavIQ</div>
            <div className="text-[10px] tracking-wider mt-1" style={{ color: 'var(--ink-mute)' }}>
              AI · Routing
            </div>
          </div>
        </Link>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto">
        <div className="text-[10.5px] uppercase tracking-[0.08em] px-3 pb-2 font-medium" style={{ color: 'var(--ink-mute)' }}>
          Workspace
        </div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all"
                style={{
                  color: active ? 'var(--accent)' : 'var(--ink-2)',
                  background: active ? 'var(--accent-tint)' : 'transparent',
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                <span style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-3">
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--stroke)',
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {profile?.full_name || 'User'}
            </div>
            <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {profile?.company_name || profile?.email}
            </div>
          </div>
          <button onClick={signOut} className="btn-danger-ghost rounded-full !p-2" title="Sign out">
            <LogOut size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — only on small screens */}
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 safe-top"
          style={{
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderBottom: '1px solid var(--stroke-dark)',
          }}
        >
          <button onClick={() => setMobileOpen(true)} className="btn btn-ghost !p-2">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold">NavIQ</div>
          </div>
          <div className="w-9" />
        </div>
      )}

      {/* Mobile drawer overlay */}
      {!isDesktop && mobileOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMobileOpen(false)}
          style={{ background: 'rgba(10,31,61,0.3)', backdropFilter: 'blur(8px)' }}
        />
      )}

      {/* Sidebar — sticky on desktop, fixed drawer on mobile */}
      <aside
        className="flex flex-col h-screen w-[260px] shrink-0"
        style={{
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
          borderRight: '1px solid var(--stroke-dark)',
          position: isDesktop ? 'sticky' : 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {!isDesktop && (
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 btn btn-ghost !p-2"
          >
            <X size={18} />
          </button>
        )}
        {NavContent}
      </aside>
    </>
  );
}
