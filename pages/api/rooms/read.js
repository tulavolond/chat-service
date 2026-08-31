import pool from '../../../lib/db';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req, res) {
  // Добавим лог, чтобы убедиться, что файл вообще выполняется
  console.log('📥 Вызван API /api/rooms/read, метод:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Метод не разрешён, используйте POST' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Невалидный токен' });
  }

  try {
    const { roomId, lastMessageId } = req.body;

    if (!roomId || !lastMessageId) {
      return res.status(400).json({ error: 'roomId и lastMessageId обязательны' });
    }

    await pool.execute(
      `INSERT INTO room_reads (user_id, room_id, last_read_id) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_id = ?, updated_at = CURRENT_TIMESTAMP`,
      [decoded.userId, roomId, lastMessageId, lastMessageId]
    );

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('markRead error:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}



// import pool from '../../../lib/db';
// import { verifyToken } from '../../../lib/auth';

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', 'POST');
//     return res.status(405).end('Method Not Allowed');
//   }

//   // Проверяем токен
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'Токен не предоставлен' });
//   }

//   const token = authHeader.substring(7);
//   const decoded = verifyToken(token);
//   if (!decoded) {
//     return res.status(401).json({ error: 'Невалидный токен' });
//   }

//   try {
//     const { roomId, lastMessageId } = req.body;

//     if (!roomId || !lastMessageId) {
//       return res.status(400).json({ error: 'roomId и lastMessageId обязательны' });
//     }

//     // Обновляем или вставляем запись о прочитанном
//     await pool.execute(
//       `INSERT INTO room_reads (user_id, room_id, last_read_id) 
//        VALUES (?, ?, ?)
//        ON DUPLICATE KEY UPDATE last_read_id = ?, updated_at = CURRENT_TIMESTAMP`,
//       [decoded.userId, roomId, lastMessageId, lastMessageId]
//     );

//     res.status(200).json({ success: true });
//   } catch (e) {
//     console.error('markRead error:', e);
//     res.status(500).json({ error: 'Ошибка сервера' });
//   }
// }