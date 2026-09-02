import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context';
import Link from 'next/link';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? form : { email: form.email, password: form.password };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка');
        return;
      }

      await login(data.token, data.user);
      router.push('/');
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-body d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center bg-dark">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow">
              <div className="card-body p-4">
                <h3 className="text-center mb-4">
                  {isRegister ? 'Регистрация' : 'Вход'}
                </h3>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {isRegister && (
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        required
                        minLength={3}
                        maxLength={64}
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Пароль</label>
                    <input
                      type="password"
                      className="form-control"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                  >
                    {loading ? 'Загрузка...' : isRegister ? 'Зарегистрироваться' : 'Войти'}
                  </button>

                </form>

                <div className="text-center mt-3">
                  <Link href="/forgot-password" className="btn btn-link">
                    Забыли пароль?
                  </Link>
                  <br />
                  <button
                    className="btn btn-link"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setError('');
                    }}
                  >
                    {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}