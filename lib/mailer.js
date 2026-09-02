// lib/mailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.beget.com', // Или smtp.gmail.com
  port: Number(process.env.SMTP_PORT || 465),       // Или 465/587
  secure: process.env.SMTP_SECURE === 'true',        // true для 465, false для других
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(email, resetUrl) {
  const mailOptions = {
    from: `"Чат-приложение" <${process.env.SMTP_FROM_EMAIL || 'noreply@example.com'}>`,
    to: email,
    subject: 'Восстановление пароля',
    html: `
      <h2>Запрос на восстановление пароля</h2>
      <p>Вы (или кто-то другой) запросили сброс пароля для вашего аккаунта.</p>
      <p>Перейдите по ссылке ниже, чтобы установить новый пароль (ссылка действительна 1 час):</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px;">
        Сбросить пароль
      </a>
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        Если вы не запрашивали это письмо, просто проигнорируйте его. Ваш пароль не будет изменён.
      </p>
    `,
  };

  await transporter.sendMail(mailOptions);
}