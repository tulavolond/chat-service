import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const roomId = String(req.query.roomId || '').trim();
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  const limit = parseInt(Math.min(Number(req.query.limit) || 50, 200));
  const before = req.query.before ? new Date(req.query.before) : null;

  try {
    let rows;
    if (before && !isNaN(before.getTime())) {
      [rows] = await pool.execute(
        `SELECT id, room_id AS roomId, user_id AS userId, username, text,
                created_at AS createdAt
         FROM messages WHERE room_id = ? AND created_at < ?
         ORDER BY created_at DESC LIMIT ?`,
        [roomId, before, limit]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT id, room_id AS roomId, user_id AS userId, username, text,
                created_at AS createdAt
         FROM messages WHERE room_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [roomId, limit]
      );
    }

    rows.reverse();
    res.status(200).json({ messages: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db error' });
  }
}