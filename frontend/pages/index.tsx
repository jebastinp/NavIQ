import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Sparkles, Zap, Navigation, MapPin } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  return (
    <div className="min-h-screen relative">
      {/* Floating glass nav */}
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 sm:px-6 py-2.5 flex items-center gap-2 sm:gap-4 glass-strong"
           style={{ borderRadius: '999px' }}>
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold">NavIQ</span>
        </Link>
        <div className="w-px h-5" style={{ background: 'var(--stroke-dark)' }} />
        <div className="flex items-center gap-1">
          <Link href="/login" className="btn btn-ghost !text-[13px] !px-3 !py-1.5">Sign in</Link>
          <Link href="/signup" className="btn btn-primary !text-[13px] !px-3.5 !py-1.5">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative px-5 sm:px-8 pt-28 sm:pt-32 pb-20 max-w-[1100px] mx-auto">
        <div className="text-center fade-up">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-7 text-[12px] font-medium"
            style={{
              background: 'var(--glass-strong)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--stroke)',
              borderRadius: '999px',
              color: 'var(--ink-2)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--good)' }} />
            Live · AI-powered routing
          </div>

          <h1 className="title-display mb-5">
            Routes that think{' '}
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              ahead.
            </span>
          </h1>

          <p className="text-[17px] sm:text-[19px] mb-9 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            Upload your stops. Assign your drivers. Let intelligent routing handle the rest —
            less fuel, less time, fewer headaches.
          </p>

          <div className="flex gap-3 flex-wrap justify-center mb-16">
            <Link href="/signup" className="btn btn-primary !text-[15px] !px-6 !py-3">
              Start free <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
            <Link href="/login" className="btn btn-glass !text-[15px] !px-6 !py-3">
              Sign in
            </Link>
          </div>
        </div>

        {/* Feature glass cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16 fade-up">
          {[
            {
              i: Zap,
              t: 'Upload & verify',
              d: 'Drop a CSV with name, address, phone. Every row is geocoded and validated.',
              g: 'linear-gradient(135deg, #5AC8FA, #0071E3)',
            },
            {
              i: Sparkles,
              t: 'AI optimize',
              d: 'Google OR-Tools VRP solver assigns stops in under 3 seconds.',
              g: 'linear-gradient(135deg, #AF52DE, #FF2D55)',
            },
            {
              i: Navigation,
              t: 'Track live',
              d: 'Drivers share location in real-time. Customers see live ETAs on their phone.',
              g: 'linear-gradient(135deg, #30D158, #5AC8FA)',
            },
          ].map((f, i) => {
            const Icon = f.i;
            return (
              <div key={i} className="glass-card p-6 text-left">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 text-white"
                  style={{ background: f.g, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="title-card mb-1.5">{f.t}</div>
                <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{f.d}</div>
              </div>
            );
          })}
        </div>

        {/* Stats strip */}
        <div className="glass-strong p-2 fade-up" style={{ borderRadius: '24px' }}>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { v: '32%', l: 'Less fuel' },
              { v: '2.4×', l: 'More stops/hour' },
              { v: '<3s', l: 'Optimize time' },
              { v: '99.9%', l: 'Accuracy' },
            ].map((s, i) => (
              <div key={i} className="p-5 sm:p-6 text-center"
                   style={{ borderRight: i < 3 ? '1px solid var(--stroke-dark)' : 'none' }}>
                <div className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-none"
                     style={{
                       background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent',
                       backgroundClip: 'text',
                     }}>{s.v}</div>
                <div className="text-[11.5px] mt-2 font-medium" style={{ color: 'var(--ink-3)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-[12px]" style={{ color: 'var(--ink-mute)' }}>
          First-time setup?{' '}
          <Link href="/diagnostic" className="font-medium" style={{ color: 'var(--accent)' }}>
            Run diagnostic →
          </Link>
        </div>
      </main>
    </div>
  );
}
