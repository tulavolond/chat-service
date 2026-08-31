import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Получаем все уникальные комнаты, в которых есть сообщения
    // + последняя активность для сортировки
    const [rows] = await pool.execute(`
      SELECT 
        room_id AS roomId,
        COUNT(*) AS messageCount,
        MAX(created_at) AS lastActivity
      FROM messages
      GROUP BY room_id
      ORDER BY lastActivity DESC
    `);

    res.status(200).json({ rooms: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db error' });
  }
}