import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
export default function AuthPage({ register = false }) {
  const { user, loading, authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <p role="status">Comprobando sesión…</p>;
  if (user) return <Navigate to="/cuenta" replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const values = { email: form.get('email'), password: form.get('password') };
    if (register) values.name = form.get('name');
    try { await authenticate(register ? 'register' : 'login', values); navigate(register ? '/preferencias' : location.state?.from || '/moods', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <><h1>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h1><p>Tu cuenta guarda tus preferencias. También puedes explorar sin registrarte.</p>
    <form className="account-form" onSubmit={submit}>
      {register && <label>Nombre<input name="name" autoComplete="name" required minLength={2} maxLength={60} disabled={busy} /></label>}
      <label>Correo<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} /></label>
      <label>Contraseña (mínimo 10 caracteres)<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} disabled={busy} /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Guardando…' : register ? 'Crear cuenta' : 'Entrar'}</button>
    </form><p><Link to={register ? '/login' : '/registro'}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</Link> · <Link to="/moods">Continuar como invitado</Link></p></>;
}
