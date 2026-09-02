// pages/api/auth/forgot-password.js
import pool from '../../../lib/db';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../../lib/mailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  try {
    // 1. Ищем пользователя (даже если его нет, возвращаем 200 для безопасности, чтобы не спамить базу)
    const [users] = await pool.execute('SELECT id, email FROM users WHERE email = ?', [email]);
    
    if (users.length > 0) {
      const user = users[0];
      
      // 2. Генерируем безопасный токен
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // 3. Устанавливаем время жизни токена (1 час)
      const expires = new Date(Date.now() + 3600000); 

      // 4. Сохраняем в БД
      await pool.execute(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [resetToken, expires, user.id]
      );

      // 5. Формируем ссылку и отправляем письмо
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailError) {
        console.error('Ошибка отправки email:', emailError);
        // Не прерываем запрос, чтобы не показывать пользователю, что email существует, но письмо не ушло
      }
    }

    // Возвращаем успех в любом случае (защита от перебора email)
    res.status(200).json({ message: 'Если аккаунт с таким email существует, мы отправили инструкцию на почту.' });
  } catch (e) {
    console.error('forgot-password error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}