import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabase';

export type AuthState = { user: any | null; profile: any | null; loading: boolean };

export function useAuth(redirectToLogin = true): AuthState {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    const sb = supabase();
    let mounted = true;

    async function check() {
      const { data: { session } } = await sb.auth.getSession();
      if (!mounted) return;
      if (!session) {
        if (redirectToLogin) router.replace('/login');
        else setState({ user: null, profile: null, loading: false });
        return;
      }
      const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if (!mounted) return;
      setState({ user: session.user, profile: profile || null, loading: false });
    }
    check();

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session && redirectToLogin) router.replace('/login');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [redirectToLogin, router]);

  return state;
}
