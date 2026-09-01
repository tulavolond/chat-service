import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const roomId = String(req.query.roomId || '').trim();
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  // const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before ? new Date(req.query.before) : null;

try {
    let rows;
    
    // Безопасно форсируем тип данных к валидному Integer
    const safeLimit = parseInt(Math.min(Number(req.query.limit) || 50, 200), 10);

    if (before && !isNaN(before.getTime())) {
      // Подставляем safeLimit прямо в строку запроса
      const [result] = await pool.query(
        `SELECT id, room_id AS roomId, user_id AS userId, username, text,
                created_at AS createdAt
         FROM messages WHERE room_id = ? AND created_at < ?
         ORDER BY created_at DESC LIMIT ${safeLimit}`,
        [roomId, before]
      );
      rows = result;
    } else {
      // Подставляем safeLimit прямо в строку запроса
      const [result] = await pool.query(
        `SELECT id, room_id AS roomId, user_id AS userId, username, text,
                created_at AS createdAt
         FROM messages WHERE room_id = ?
         ORDER BY created_at DESC LIMIT ${safeLimit}`,
        [roomId]
      );
      rows = result;
    }

    rows.reverse();
    res.status(200).json({ messages: rows });
  } catch (e) {
    console.error("Ошибка при запросе сообщений:", e);
    res.status(500).json({ error: 'db error' });
  }
}