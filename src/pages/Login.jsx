import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Input, Alert } from '../components/ui.jsx';
import { isConfigured } from '../lib/supabase.js';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  if (!isConfigured()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="topbar-brand-tag">CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 28, marginBottom: 16 }}>Configuração necessária</h1>
          <Alert variant="warn" title="Supabase não configurado">As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas. Consulte o README para configurar o Supabase.</Alert>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F1F0EC' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="topbar-brand-tag" style={{ fontSize: 11 }}>CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 32, fontWeight: 600, color: '#1F2937', marginTop: 6 }}>ATAS PRO</h1>
        </div>
        <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 20, fontWeight: 600 }}>Entrar</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Email" type="email" value={email} onChange={setEmail} required placeholder="nome@pa-legal.pt" />
            <Input label="Password" type="password" value={password} onChange={setPassword} required />
            {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: 8, background: '#FEE2E2', borderRadius: 6 }}>{error}</div>}
            <Btn type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>{loading ? 'A entrar...' : 'Entrar'}</Btn>
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Sem conta? Contacte o administrador.</div>
        </form>
      </div>
    </div>
  );
}
