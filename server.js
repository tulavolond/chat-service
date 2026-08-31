const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {

  // --- MySQL
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB || 'chat_db',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });

  const server = createServer((req, res) => handle(req, res));

  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: '*' },
  });

  // Больше никакого Redis. Socket.io сам хранит комнаты в памяти этого процесса.

  io.on('connection', (socket) => {
    console.log('client connected:', socket.id);

    socket.on('join', (roomId) => {
      if (typeof roomId === 'string' && roomId.length) {
        socket.join(roomId);
        socket.data.roomId = roomId;
      }
    });

    // --- Отправка сообщения ---
    socket.on('sendMessage', async (payload) => {
      try {
        const { roomId, userId, username, text } = payload || {};
        if (!roomId || !userId || !text) {
          socket.emit('error', { message: 'Invalid payload' });
          return;
        }

        // 1) Сохраняем в БД
        const [result] = await pool.execute(
          'INSERT INTO messages (room_id, user_id, username, text) VALUES (?, ?, ?, ?)',
          [roomId, userId, username || 'anon', String(text).slice(0, 4000)]
        );

        const message = {
          id: result.insertId,
          roomId,
          userId,
          username: username || 'anon',
          text: String(text).slice(0, 4000),
          createdAt: new Date().toISOString(),
        };

        // 2) Успешно записано → сразу рассылаем ВСЕМ в комнате (включая отправителя)
        io.to(roomId).emit('message', message);

      } catch (err) {
        console.error('sendMessage error:', err);
        socket.emit('error', { message: 'Failed to save message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('client disconnected:', socket.id);
    });
  });

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, () => {
    console.log(`> Chat service on http://localhost:${PORT}`);
  });
});