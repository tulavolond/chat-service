// pages/api/auth/reset-password.js
import pool from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }

  try {
    // 1. Ищем пользователя с этим токеном, который ещё не истёк
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Ссылка недействительна или срок её действия истёк' });
    }

    const userId = users[0].id;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 2. Обновляем пароль и очищаем токен
    await pool.execute(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, userId]
    );

    res.status(200).json({ message: 'Пароль успешно изменён' });
  } catch (e) {
    console.error('reset-password error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}