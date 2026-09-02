// pages/forgot-password.js
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Ошибка');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-dark d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow">
              <div className="card-body p-4">
                <h3 className="text-center mb-4">Восстановление пароля</h3>

                {message && <div className="alert alert-success">{message}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                {!message && (
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Введите ваш Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                      {loading ? 'Отправка...' : 'Отправить ссылку'}
                    </button>
                  </form>
                )}

                <div className="text-center mt-3">
                  <Link href="/login" className="btn btn-link">
                    ← Вернуться ко входу
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}