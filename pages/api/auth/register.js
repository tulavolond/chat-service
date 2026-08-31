import pool from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { username, email, password } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (username.length < 3 || username.length > 64) {
      return res.status(400).json({ error: 'Username: 3-64 символа' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username: только латиница, цифры, _ и -' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль: минимум 6 символов' });
    }

    // Проверяем уникальность
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username или email уже заняты' });
    }

    // Хэшируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const user = {
      id: result.insertId,
      username,
      email,
    };

    // Генерируем JWT
    const token = signToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (e) {
    console.error('register error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}