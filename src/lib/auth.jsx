import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profissional, setProfissional] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProf(data.session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProf(s.user.id); else { setProfissional(null); setLoading(false); }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const loadProf = async (userId) => {
    const { data } = await supabase.from('profissionais').select('*').eq('user_id', userId).maybeSingle();
    setProfissional(data);
    setLoading(false);
  };

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };
  const signUp = async (email, password, nome) => {
    return await supabase.auth.signUp({ email, password, options: { data: { nome } } });
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <AuthCtx.Provider value={{ session, profissional, loading, signIn, signUp, signOut, refresh: () => session && loadProf(session.user.id) }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
