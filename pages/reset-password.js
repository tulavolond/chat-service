// pages/reset-password.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Если токена нет в URL, сразу показываем ошибку
  useEffect(() => {
    if (router.isReady && !token) {
      setError('Неверная ссылка. Токен отсутствует.');
    }
  }, [router.isReady, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      return setError('Пароли не совпадают');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000); // Редирект через 3 сек
      } else {
        setError(data.error || 'Ошибка');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-vh-100 bg-body d-flex align-items-center">
        <div className="container text-center">
          <div className="alert alert-success">
            <h4>✅ Пароль успешно изменён!</h4>
            <p>Перенаправляем на страницу входа...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-body d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow">
              <div className="card-body p-4">
                <h3 className="text-center mb-4">Новый пароль</h3>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Новый пароль</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Подтвердите пароль</label>
                    <input
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100" disabled={loading || !token}>
                    {loading ? 'Сохранение...' : 'Сохранить пароль'}
                  </button>
                </form>

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