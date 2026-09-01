// pages/api/rooms.js
import pool from '../../lib/db';
import { verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
  // 1. Разрешаем только GET запросы
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Проверяем токен авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Невалидный токен' });
  }

  const userId = decoded.userId;
  console.log('🔍 Запрос комнат для userId:', userId);

  try {
    // 3. Считаем именно НЕПРОЧИТАННЫЕ сообщения через LEFT JOIN с room_reads
    const [rows] = await pool.execute(
      `SELECT 
        m.room_id AS roomId,
        COUNT(m.id) AS totalMessages,
        COALESCE(MAX(m.id), 0) AS lastMessageId,
        COALESCE(rr.last_read_id, 0) AS lastReadId,
        COUNT(CASE WHEN m.id > COALESCE(rr.last_read_id, 0) THEN 1 END) AS unreadCount
      FROM messages m
      LEFT JOIN room_reads rr 
        ON rr.room_id = m.room_id AND rr.user_id = ?
      GROUP BY m.room_id, rr.last_read_id
      ORDER BY lastMessageId DESC`,
      [userId]
    );

    console.log('✅ Найдены комнаты:', rows);

    // 4. Гарантированно добавляем комнату 'general', даже если в ней пока нет сообщений
    const hasGeneral = rows.some((r) => r.roomId === 'general');
    if (!hasGeneral) {
      rows.unshift({
        roomId: 'general',
        totalMessages: 0,
        lastMessageId: 0,
        lastReadId: 0,
        unreadCount: 0,
      });
    }

    // 5. Отправляем результат клиенту
    res.status(200).json({ rooms: rows });
  } catch (e) {
    console.error('❌ Ошибка в /api/rooms:', e);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
}




// import pool from '../../lib/db';

// export default async function handler(req, res) {
//   if (req.method !== 'GET') {
//     res.setHeader('Allow', 'GET');
//     return res.status(405).end('Method Not Allowed');
//   }

//   try {
//     // Получаем все уникальные комнаты, в которых есть сообщения
//     // + последняя активность для сортировки
//     const [rows] = await pool.execute(`
//       SELECT 
//         room_id AS roomId,
//         COUNT(*) AS messageCount,
//         MAX(created_at) AS lastActivity
//       FROM messages
//       GROUP BY room_id
//       ORDER BY lastActivity DESC
//     `);

//     res.status(200).json({ rooms: rows });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: 'db error' });
//   }
// }
