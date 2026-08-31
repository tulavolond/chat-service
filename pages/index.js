import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const ROOM_ID = 'general';
const USER_ID = 'user-1';
const USERNAME = 'Alice';

export default function Home({ theme, setTheme }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Автопрокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Загрузка истории
  useEffect(() => {
    fetch(`/api/messages?roomId=${ROOM_ID}&limit=50`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(console.error);
  }, []);

  // Подключение к сокетам
  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', ROOM_ID);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message', (msg) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });

    socket.on('error', (e) => console.error('socket error', e));

    return () => socket.disconnect();
  }, []);

  const send = () => {
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      roomId: ROOM_ID,
      userId: USER_ID,
      username: USERNAME,
      text: text.trim(),
    });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="min-vh-80">
      {/* Header */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div className="container">
          <span className="navbar-brand mb-0 h1">
            💬 Chat
          </span>
          <span className="navbar-text">
            <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'} me-2`}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
            <span className="text-white-50">Комната: <strong>{ROOM_ID}</strong></span>
          </span>
        </div>
      </nav>

      {/* Main */}
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-md-10">
            
            {/* Chat Card */}
            <div className="card shadow">
              <div className="card-header bg-gray py-3">
                <h5 className="mb-0 text-primary">
                  📝 Сообщения
                </h5>
              </div>
              
              {/* Messages Area */}
              <div 
                className="card-body"
                style={{ height: '500px', overflowY: 'auto' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <p className="mb-0">Нет сообщений</p>
                    <small>Будьте первым!</small>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`mb-3 ${m.userId === USER_ID ? 'text-end' : 'text-start'}`}
                    >
                      <div
                        className={`d-inline-block px-3 py-2 rounded-3 ${
                          m.userId === USER_ID
                            ? 'bg-primary text-white'
                            : 'bg-white border'
                        }`}
                        style={{ maxWidth: '70%' }}
                      >
                        {m.userId !== USER_ID && (
                          <small className="d-block text-primary mb-1 fw-bold">
                            {m.username}
                          </small>
                        )}
                        <p className="mb-1">{m.text}</p>
                        <small className={m.userId === USER_ID ? 'text-white-50' : 'text-muted'}>
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </small>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="card-footer bg-blue">
                          
          {/* Переключатель темы */}
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="themeSwitch"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
            />
            <label className="form-check-label text-white" htmlFor="themeSwitch">
              {theme === 'dark' ? '🌙' : '☀️'}
            </label>
          </div>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Введите сообщение..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isConnected}
                  />
                  <button
                    className="btn btn-primary btn-lg px-4"
                    onClick={send}
                    disabled={!isConnected || !text.trim()}
                  >
                    Отправить
                  </button>
                </div>
                <small className="text-muted mt-2 d-block">
                  Нажмите Enter для отправки
                </small>
              </div>
            </div>

            {/* Stats */}
            <div className="row mt-3">
              <div className="col-6">
                <div className="card text-center">
                  <div className="card-body py-2">
                    <h6 className="text-muted mb-0">Сообщений</h6>
                    <h3 className="mb-0 text-primary">{messages.length}</h3>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="card text-center">
                  <div className="card-body py-2">
                    <h6 className="text-muted mb-0">Комната</h6>
                    <h6 className="mb-0 text-success">{ROOM_ID}</h6>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}