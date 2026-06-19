import { useEffect, useState } from 'react';
import { AdminUnauthorizedError, fetchAdminMe, loginAdmin } from '../services/adminApi';
import './AdminLoginPage.css';

const goToAdminLives = () => {
  window.location.hash = '/admin/lives';
};

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    fetchAdminMe()
      .then((admin) => {
        if (!isCancelled && admin) goToAdminLives();
      })
      .catch((err) => {
        if (!(err instanceof AdminUnauthorizedError)) {
          console.warn('admin-auth: failed to check current admin session.', err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await loginAdmin(email.trim(), password);
      goToAdminLives();
    } catch {
      setError('Email ou senha invalidos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <div className="admin-login-brand">
          <span>BE</span>
          <div>
            <strong>BIZ EYE</strong>
            <small>Admin</small>
          </div>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="admin-login-error">{error}</p>}

          <button disabled={isLoading} type="submit">
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default AdminLoginPage;
