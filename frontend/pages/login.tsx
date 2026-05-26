import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Sign in failed');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 sm:px-6 py-10">
      <div className="w-full max-w-[420px] fade-up">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] mb-7" style={{ color: 'var(--ink-3)' }}>
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="flex items-center gap-2.5 mb-7">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              boxShadow: '0 6px 16px var(--accent-shadow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <div className="text-[20px] font-semibold tracking-tight">NavIQ</div>
        </div>

        <h1 className="title-page mb-2">Welcome back</h1>
        <p className="text-[14px] mb-7" style={{ color: 'var(--ink-3)' }}>
          Sign in to your account.
        </p>

        <div className="glass-strong p-6 sm:p-7">
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="fld">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="fld">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="input" placeholder="••••••••" />
            </div>

            {error && (
              <div className="text-[12.5px] px-3.5 py-2.5 rounded-xl"
                style={{ color: 'var(--bad)', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full !py-3 !text-[15px]">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] mt-6" style={{ color: 'var(--ink-3)' }}>
          New here?{' '}
          <Link href="/signup" className="font-medium" style={{ color: 'var(--accent)' }}>
            Create an account →
          </Link>
        </p>
      </div>
    </div>
  );
}
