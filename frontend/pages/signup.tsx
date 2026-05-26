import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    setLoading(true);
    try {
      const sb = supabase();
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      if (data.user && companyName) {
        await sb.from('profiles').update({ company_name: companyName }).eq('id', data.user.id);
      }
      if (data.session) {
        router.push('/dashboard');
      } else {
        setInfo('Check your email to confirm, then sign in.');
      }
    } catch (e: any) {
      setError(e.message || 'Signup failed');
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

        <h1 className="title-page mb-2">Create account</h1>
        <p className="text-[14px] mb-7" style={{ color: 'var(--ink-3)' }}>
          Get started in under a minute.
        </p>

        <div className="glass-strong p-6 sm:p-7">
          <form onSubmit={signUp} className="space-y-4">
            <div>
              <label className="fld">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus className="input" placeholder="Alex Morgan" />
            </div>
            <div>
              <label className="fld">Company <span style={{ color: 'var(--ink-mute)' }}>· optional</span></label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" placeholder="Acme Logistics" />
            </div>
            <div>
              <label className="fld">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="fld">Password <span style={{ color: 'var(--ink-mute)' }}>· min 6</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="input" placeholder="••••••••" />
            </div>

            {error && (
              <div className="text-[12.5px] px-3.5 py-2.5 rounded-xl"
                style={{ color: 'var(--bad)', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
                {error}
              </div>
            )}
            {info && (
              <div className="text-[12.5px] px-3.5 py-2.5 rounded-xl"
                style={{ color: 'var(--good)', background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.30)' }}>
                {info}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full !py-3 !text-[15px]">
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] mt-6" style={{ color: 'var(--ink-3)' }}>
          Already have one?{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
