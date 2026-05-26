import { useState } from 'react';
import Link from 'next/link';
import { supabase, BACKEND_URL } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle, Stethoscope } from 'lucide-react';

type Check = { name: string; status: 'pending' | 'pass' | 'fail' | 'warn'; detail?: string };

export default function DiagnosticPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  async function runDiagnostic() {
    setRunning(true);
    const results: Check[] = [];

    // 1. Backend health
    results.push({ name: 'Backend reachable', status: 'pending' });
    setChecks([...results]);
    try {
      const r = await fetch(`${BACKEND_URL}/health`);
      if (r.ok) results[0] = { ...results[0], status: 'pass', detail: 'API responding' };
      else results[0] = { ...results[0], status: 'fail', detail: `HTTP ${r.status}` };
    } catch (e: any) {
      results[0] = { ...results[0], status: 'fail', detail: `Cannot reach ${BACKEND_URL}` };
    }
    setChecks([...results]);

    // 2. Supabase session
    results.push({ name: 'Supabase session', status: 'pending' });
    setChecks([...results]);
    try {
      const { data, error } = await supabase().auth.getSession();
      if (error) results[1] = { ...results[1], status: 'fail', detail: error.message };
      else if (!data.session) results[1] = { ...results[1], status: 'warn', detail: 'Not signed in' };
      else results[1] = { ...results[1], status: 'pass', detail: 'Signed in' };
    } catch (e: any) {
      results[1] = { ...results[1], status: 'fail', detail: e.message };
    }
    setChecks([...results]);

    // 3. Profile row exists
    results.push({ name: 'Profile row exists', status: 'pending' });
    setChecks([...results]);
    try {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        results[2] = { ...results[2], status: 'warn', detail: 'Sign in first to check' };
      } else {
        const { data, error } = await sb.from('profiles').select('id').eq('id', user.id).single();
        if (error || !data) results[2] = { ...results[2], status: 'fail', detail: error?.message || 'No row found' };
        else results[2] = { ...results[2], status: 'pass', detail: `Profile ${user.id.slice(0, 8)}…` };
      }
    } catch (e: any) {
      results[2] = { ...results[2], status: 'fail', detail: e.message };
    }
    setChecks([...results]);

    // 4. Backend auth
    results.push({ name: 'Backend authenticates token', status: 'pending' });
    setChecks([...results]);
    try {
      const { data } = await supabase().auth.getSession();
      if (!data.session) {
        results[3] = { ...results[3], status: 'warn', detail: 'No session to test' };
      } else {
        const r = await fetch(`${BACKEND_URL}/auth-debug`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (r.ok) {
          const json = await r.json();
          if (json.ok) results[3] = { ...results[3], status: 'pass', detail: `Auth OK via ${json.method}` };
          else results[3] = { ...results[3], status: 'fail', detail: json.error || 'Unknown' };
        } else {
          const t = await r.text();
          results[3] = { ...results[3], status: 'fail', detail: `HTTP ${r.status}: ${t.slice(0, 100)}` };
        }
      }
    } catch (e: any) {
      results[3] = { ...results[3], status: 'fail', detail: e.message };
    }
    setChecks([...results]);

    // 5. Drivers table has start_lat column
    results.push({ name: 'Drivers table has start_lat column', status: 'pending' });
    setChecks([...results]);
    try {
      const { error } = await supabase().from('drivers').select('start_lat').limit(1);
      if (error) results[4] = { ...results[4], status: 'fail', detail: 'Run schema migration: ALTER TABLE drivers ADD COLUMN IF NOT EXISTS start_lat NUMERIC(10,7);' };
      else results[4] = { ...results[4], status: 'pass', detail: 'Migration applied' };
    } catch (e: any) {
      results[4] = { ...results[4], status: 'fail', detail: e.message };
    }
    setChecks([...results]);

    setRunning(false);
  }

  return (
    <div className="min-h-screen p-5 sm:p-8">
      <div className="max-w-2xl mx-auto fade-up">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] mb-6" style={{ color: 'var(--ink-3)' }}>
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', boxShadow: '0 6px 16px var(--accent-shadow)' }}>
            <Stethoscope size={20} strokeWidth={2} />
          </div>
          <h1 className="title-page">Diagnostic</h1>
        </div>
        <p className="text-[14px] mb-6" style={{ color: 'var(--ink-3)' }}>
          Verifies your environment is set up correctly.
        </p>

        <button onClick={runDiagnostic} disabled={running} className="btn btn-primary mb-6">
          {running ? <><Loader2 size={14} className="animate-spin" />Running…</> : 'Run diagnostic'}
        </button>

        {checks.length > 0 && (
          <div className="glass-strong p-2 fade-up">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl"
                   style={{ borderBottom: i < checks.length - 1 ? '1px solid var(--stroke-dark)' : 'none' }}>
                <div className="mt-0.5 shrink-0">
                  {c.status === 'pending' && <Loader2 size={17} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />}
                  {c.status === 'pass' && <CheckCircle2 size={17} style={{ color: 'var(--good)' }} />}
                  {c.status === 'fail' && <XCircle size={17} style={{ color: 'var(--bad)' }} />}
                  {c.status === 'warn' && <AlertCircle size={17} style={{ color: 'var(--warn)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{c.name}</div>
                  {c.detail && (
                    <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>
                      {c.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
