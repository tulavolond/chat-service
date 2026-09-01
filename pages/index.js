import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { useAuth } from '../lib/auth-context';

export default function Home({ theme, setTheme }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showNewRoomInput, setShowNewRoomInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentRoomRef = useRef(currentRoom); // 🔥 Храним актуальную комнату в ref

  // Синхронизируем ref с state
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Редирект если не авторизован
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Автопрокрутка
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Загрузка списка комнат
    const loadRooms = async () => {
    if (!user) {
      console.log('🚫 loadRooms: user is null');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      // console.log('📤 loadRooms: запрос к /api/rooms, token:', token ? 'есть' : 'нет');
      
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // console.log('📥 loadRooms: статус ответа:', res.status);
      
      const data = await res.json();
      // console.log('📥 loadRooms: данные:', data);
      
      setRooms(data.rooms || []);
    } catch (e) {
      console.error('❌ loadRooms error', e);
    }
  };
  // const loadRooms = async () => {
  //   if (!user) return;
  //   try {
  //     const token = localStorage.getItem('token');
  //     const res = await fetch('/api/rooms', {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     const data = await res.json();
  //     setRooms(data.rooms || []);
  //   } catch (e) {
  //     console.error('loadRooms error', e);
  //   }
  // };

  // Загрузка истории комнаты
    const loadMessages = async (roomId) => {
    try {
      const res = await fetch(`/api/messages?roomId=${roomId}&limit=50`);
      const data = await res.json();
      const msgs = data.messages || [];
      setMessages(msgs);

      // Отмечаем как прочитанное и ЖДЁМ завершения
      if (msgs.length > 0) {
        const lastMessageId = msgs[msgs.length - 1].id;
        await markRoomAsRead(roomId, lastMessageId);
      }
    } catch (e) {
      console.error('loadMessages error', e);
    }
  };
//   const loadMessages = async (roomId) => {
//     try {
//       const res = await fetch(`/api/messages?roomId=${roomId}&limit=50`);
//       const data = await res.json();
//       setMessages(data.messages || []);

//       if (data.messages && data.messages.length > 0) {
//         const lastMessageId = data.messages[data.messages.length - 1].id;
//         markRoomAsRead(roomId, lastMessageId);
//       }
//     } catch (e) {
//       console.error('loadMessages error', e);
//     }
//   };

  // Отметить комнату как прочитанную
  const markRoomAsRead = async (roomId, lastMessageId) => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/rooms/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, lastMessageId }),
      });
    } catch (e) {
      console.error('markRoomAsRead error', e);
    }
  };
  
    // 🔥 Polling — обновляем список комнат каждые 10 секунд
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      loadRooms();
    }, 10000); // 10 секунд

    return () => clearInterval(interval);
  }, [user]);

  // Инициализация — загрузка комнат и первого сообщения
  useEffect(() => {
    if (user) {
      loadRooms();
      loadMessages(currentRoom);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔥 ПОДКЛЮЧЕНИЕ К СОКЕТАМ — БЕЗ currentRoom В ЗАВИСИМОСТЯХ!
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const socket = io({
      path: '/socket.io',
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', currentRoomRef.current);
    });

    // socket.on('connect', async () => {
    //   setIsConnected(true);
      
    //   // 🔥 Получаем список всех комнат
    //   const token = localStorage.getItem('token');
    //   const res = await fetch('/api/rooms', {
    //     headers: { Authorization: `Bearer ${token}` },
    //   });
    //   const data = await res.json();
    //   const allRoomIds = (data.rooms || []).map((r) => r.roomId);
      
    //   // 🔥 Подписываемся на ВСЕ комнаты
    //   socket.emit('joinAllRooms', allRoomIds);
    // });

    // socket.on('connect', () => {
    //   setIsConnected(true);
    //   socket.emit('join', currentRoomRef.current);
    // });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // События "печатает"
    socket.on('userTyping', ({ username }) => {
      setTypingUsers((prev) => {
        if (!prev.includes(username)) {
          return [...prev, username];
        }
        return prev;
      });
    });

    socket.on('userStopTyping', ({ username }) => {
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    });

    // 🔥 ГЛАВНАЯ ЛОГИКА СООБЩЕНИЙ — используем currentRoomRef.current

    socket.on('message', (msg) => {
      const activeRoom = currentRoomRef.current;

      if (msg.roomId === activeRoom) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markRoomAsRead(activeRoom, msg.id);
      }
      // 🔥 Убрали loadRooms() — polling сам обновит
    });

    // socket.on('message', (msg) => {
    //   const activeRoom = currentRoomRef.current;

    //   if (msg.roomId === activeRoom) {
    //     // Сообщение в ТЕКУЩЕЙ комнате — добавляем
    //     setMessages((prev) => {
    //       if (prev.some((m) => m.id === msg.id)) return prev;
    //       return [...prev, msg];
    //     });
    //     markRoomAsRead(activeRoom, msg.id);
    //   } else {
    //     // Сообщение в ДРУГОЙ комнате — обновляем счётчики
    //     loadRooms();
    //   }
    // });

    // socket.on('message', (msg) => {
    //   const activeRoom = currentRoomRef.current;
      
    //   if (msg.roomId === activeRoom) {
    //     // Сообщение в ТЕКУЩЕЙ комнате — добавляем и сразу отмечаем как прочитанное
    //     setMessages((prev) => {
    //       if (prev.some((m) => m.id === msg.id)) return prev;
    //       const newMessages = [...prev, msg];
    //       markRoomAsRead(activeRoom, msg.id);
    //       return newMessages;
    //     });
    //   } else {
    //     // Сообщение в ДРУГОЙ комнате — обновляем список комнат (счётчик непрочитанных)
    //     loadRooms();
    //   }
    // });

    socket.on('error', (e) => console.error('socket error', e));

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
    };
  }, [user]); // 🔥 ТОЛЬКО user! Не currentRoom!

  // Переключение комнаты

  const switchRoom = async (roomId) => {
    if (roomId === currentRoom) return;

    // 🔥 УБРАЛИ leave/join — клиент уже подписан на все комнаты!
    // if (socketRef.current) {
    //   socketRef.current.emit('leave', currentRoom);
    //   socketRef.current.emit('join', roomId);
    // }

    setCurrentRoom(roomId);
    setMessages([]);
    setSidebarOpen(false);
    setTypingUsers([]);

    await loadMessages(roomId);
    // 🔥 loadRooms() убрал — polling сам обновит через 10 сек
    // Но можно оставить для мгновенного обновления:
    // await loadRooms();
  };

//     const switchRoom = async (roomId) => {
//     if (roomId === currentRoom) return;

//     if (socketRef.current) {
//       socketRef.current.emit('leave', currentRoom);
//       socketRef.current.emit('join', roomId);
//     }

//     setCurrentRoom(roomId);
//     setMessages([]);
//     setSidebarOpen(false);
//     setTypingUsers([]);

//     // 🔥 СНАЧАЛА загружаем сообщения и отмечаем как прочитанное
//     await loadMessages(roomId);
//     // 🔥 ТОЛЬКО ПОТОМ обновляем список комнат (счётчики уже обнулены в БД)
//     await loadRooms();
//   };


//   const switchRoom = (roomId) => {
//     if (roomId === currentRoom) return;

//     if (socketRef.current) {
//       socketRef.current.emit('leave', currentRoom);
//       socketRef.current.emit('join', roomId);
//     }

//     setCurrentRoom(roomId);
//     setMessages([]);
//     setSidebarOpen(false);
//     setTypingUsers([]);

//     loadMessages(roomId);
//     loadRooms(); // 🔥 Обновляем список комнат после переключения
//   };

  // Создание комнаты

    const createRoom = async () => {
    const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    if (!/^[a-z0-9-]+$/.test(name)) {
      alert('Только латиница, цифры и дефис');
      return;
    }

    // Переключаемся на новую комнату
    await switchRoom(name);
    setNewRoomName('');
    setShowNewRoomInput(false);

    // 🔥 Подписываемся на новую комнату
    if (socketRef.current) {
      socketRef.current.emit('join', name);
    }
  };
//   const createRoom = () => {
//     const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');
//     if (!name) return;
//     if (!/^[a-z0-9-]+$/.test(name)) {
//       alert('Только латиница, цифры и дефис');
//       return;
//     }
//     switchRoom(name);
//     setNewRoomName('');
//     setShowNewRoomInput(false);
//   };

  // Обработка ввода текста
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setText(newValue);

    if (!socketRef.current || !newValue.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current?.emit('stopTyping', { roomId: currentRoom, username: user.username });
      return;
    }

    socketRef.current.emit('typing', { roomId: currentRoom, username: user.username });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('stopTyping', { roomId: currentRoom, username: user.username });
    }, 2000);
  };

  // Отправка сообщения
  const send = () => {
    if (!text.trim() || !socketRef.current) return;
    
    socketRef.current.emit('sendMessage', {
      roomId: currentRoom,
      text: text.trim(),
    });
    
    setText('');
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit('stopTyping', { roomId: currentRoom, username: user.username });
    setTypingUsers([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (loading || !user) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-body d-flex flex-column">
      <nav className="navbar navbar-dark bg-primary shadow-sm">
        <div className="container-fluid">
          <button
            className="btn btn-link text-white d-lg-none p-0 me-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <span className="navbar-brand mb-0 h1">💬 Chat</span>
          <div className="d-flex align-items-center gap-3">
            <span className="navbar-text text-white">👤 {user.username}</span>
            <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
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
            <button className="btn btn-outline-light btn-sm" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid flex-grow-1 py-3">
        <div className="row g-3">
          <div className={`col-lg-3 ${sidebarOpen ? 'd-block' : 'd-none d-lg-block'}`}>
            <div className="card shadow-sm sticky-top" style={{ top: '1rem' }}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Комнаты</h6>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowNewRoomInput(!showNewRoomInput)}
                  title="Создать комнату"
                >
                  +
                </button>
              </div>

              {showNewRoomInput && (
                <div className="card-body border-bottom p-2">
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="название-комнаты"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                      autoFocus
                    />
                    <button className="btn btn-success" onClick={createRoom}>
                      ✓
                    </button>
                  </div>
                </div>
              )}

              <div
                className="list-group list-group-flush"
                style={{ maxHeight: '70vh', overflowY: 'auto' }}
              >
                {rooms.map((r) => (
                  <button
                    key={r.roomId}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      currentRoom == r.roomId ? 'active' : ''
                    }`}
                    onClick={() => switchRoom(r.roomId)}
                  >
                    <span># {r.roomId}</span>
                    {r.unreadCount > 0 && currentRoom != r.roomId && (
                      <span className="badge bg-danger rounded-pill">
                        {r.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-9">
            <div className="card shadow-sm">
              <div className="card-header py-3">
                <h5 className="mb-0 text-primary"># {currentRoom}</h5>
              </div>

              <div
                className="card-body bg-body"
                style={{ height: '60vh', overflowY: 'auto' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <p className="mb-0">Пока нет сообщений</p>
                    <small>Напишите первое!</small>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`mb-3 ${m.userId == user.id ? 'text-end' : 'text-start'}`}
                    >
                      <div
                        className={`d-inline-block px-3 py-2 rounded-3 ${
                          m.userId === user.id ? 'bg-primary text-white' : 'bg-body border'
                        }`}
                        style={{ maxWidth: '70%' }}
                      >
                        {m.userId !== user.id && (
                          <small className="d-block text-primary mb-1 fw-bold">
                            {m.username}
                          </small>
                        )}
                        <p className="mb-1">{m.text}</p>
                        <small
                          className={m.userId === user.id ? 'text-white-50' : 'text-muted'}
                        >
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </small>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {typingUsers.length > 0 && (
                <div className="px-3 pb-2">
                  <small className="text-muted fst-italic">
                    {typingUsers.length === 1 
                      ? `✍️ ${typingUsers[0]} печатает...` 
                      : `✍️ Печатают: ${typingUsers.join(', ')}`
                    }
                  </small>
                </div>
              )}

              <div className="card-footer">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder={`Сообщение в #${currentRoom}...`}
                    value={text}
                    onChange={handleInputChange}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




// import { useEffect, useRef, useState } from 'react';
// import { useRouter } from 'next/router';
// import { io } from 'socket.io-client';
// import { useAuth } from '../lib/auth-context';

// export default function Home({ theme, setTheme }) {
//   const { user, loading, logout } = useAuth();
//   const router = useRouter();

//   const [rooms, setRooms] = useState([]);
//   const [currentRoom, setCurrentRoom] = useState('general');
//   const [messages, setMessages] = useState([]);
//   const [text, setText] = useState('');
//   const [isConnected, setIsConnected] = useState(false);
//   const [newRoomName, setNewRoomName] = useState('');
//   const [showNewRoomInput, setShowNewRoomInput] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   // ... существующие useState
//   const [typingUsers, setTypingUsers] = useState([]); // Кто печатает прямо сейчас
  
//   // ... существующие useRef
//   const typingTimeoutRef = useRef(null); // Таймер для остановки "печатает"

//   const socketRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   // Редирект если не авторизован
//   useEffect(() => {
//     if (!loading && !user) {
//       router.push('/login');
//     }
//   }, [user, loading, router]);

//   // Автопрокрутка
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Загрузка списка комнат
//   const loadRooms = async () => {
//     if (!user) return;
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch('/api/rooms', {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setRooms(data.rooms || []);
//     } catch (e) {
//       console.error('loadRooms error', e);
//     }
//   };

//   // Загрузка истории комнаты
//   const loadMessages = async (roomId) => {
//     try {
//       const res = await fetch(`/api/messages?roomId=${roomId}&limit=50`);
//       const data = await res.json();
//       setMessages(data.messages || []);

//       // Отмечаем комнату как прочитанную
//       if (data.messages && data.messages.length > 0) {
//         const lastMessageId = data.messages[data.messages.length - 1].id;
//         markRoomAsRead(roomId, lastMessageId);
//       }
//     } catch (e) {
//       console.error('loadMessages error', e);
//     }
//   };

//   // Отметить комнату как прочитанную
//   const markRoomAsRead = async (roomId, lastMessageId) => {
//     if (!user) return;
//     try {
//       const token = localStorage.getItem('token');
//       await fetch('/api/rooms/read', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ roomId, lastMessageId }),
//       });
//     } catch (e) {
//       console.error('markRoomAsRead error', e);
//     }
//   };

//   // Инициализация
//   useEffect(() => {
//     if (user) {
//       loadRooms();
//       loadMessages(currentRoom);
//     }
//   }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  
//   // Обработка ввода текста (с задержкой, чтобы не спамить сервер)
//   const handleInputChange = (e) => {
//     const newValue = e.target.value;
//     setText(newValue);

//     if (!socketRef.current || !newValue.trim()) {
//       // Если поле очистили, сразу снимаем статус "печатает"
//       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//       socketRef.current?.emit('stopTyping', { roomId: currentRoom, username: user.username });
//       return;
//     }

//     // Отправляем "печатает"
//     socketRef.current.emit('typing', { roomId: currentRoom, username: user.username });

//     // Сбрасываем предыдущий таймер
//     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

//     // Устанавливаем новый таймер: если пользователь не печатает 2 секунды, снимаем статус
//     typingTimeoutRef.current = setTimeout(() => {
//       socketRef.current.emit('stopTyping', { roomId: currentRoom, username: user.username });
//     }, 2000);
//   };


//   // Подключение к сокетам
//   useEffect(() => {
//     if (!user) return;

//     const token = localStorage.getItem('token');
//     const socket = io({
//       path: '/socket.io',
//       auth: { token },
//     });
//     socketRef.current = socket;

//     socket.on('connect', () => {
//       setIsConnected(true);
//       socket.emit('join', currentRoom);
//     });

//     socket.on('disconnect', () => {
//       setIsConnected(false);
//     });

//     // --- НОВЫЕ СОБЫТИЯ ДЛЯ "ПЕЧАТАЕТ" ---
//     socket.on('userTyping', ({ username }) => {
//       setTypingUsers((prev) => {
//         if (!prev.includes(username)) {
//           return [...prev, username];
//         }
//         return prev;
//       });
//     });

//     socket.on('userStopTyping', ({ username }) => {
//       setTypingUsers((prev) => prev.filter((u) => u !== username));
//     });
//     // -------------------------------------

//     socket.on('message', (msg) => {
//       if (msg.roomId === currentRoom) {
//         setMessages((prev) => {
//           if (prev.some((m) => m.id === msg.id)) return prev;
//           const newMessages = [...prev, msg];
//           markRoomAsRead(currentRoom, msg.id);
//           return newMessages;
//         });
//       } else {
//         loadRooms();
//       }
//     });

//     socket.on('error', (e) => console.error('socket error', e));

//     return () => {
//       // Очистка таймера при размонтировании
//       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//       socket.disconnect();
//     };
//   }, [user, currentRoom]); 

// //   useEffect(() => {
// //     if (!user) return;

// //     const token = localStorage.getItem('token');
// //     const socket = io({
// //       path: '/socket.io',
// //       auth: { token },
// //     });
// //     socketRef.current = socket;

// //     socket.on('connect', () => {
// //       setIsConnected(true);
// //       socket.emit('join', currentRoom);
// //     });

// //     socket.on('disconnect', () => {
// //       setIsConnected(false);
// //     });

// //     socket.on('message', (msg) => {
// //       if (msg.roomId === currentRoom) {
// //         setMessages((prev) => {
// //           if (prev.some((m) => m.id === msg.id)) return prev;
// //           const newMessages = [...prev, msg];

// //           // Если это текущая комната — сразу отмечаем как прочитанное
// //           markRoomAsRead(currentRoom, msg.id);

// //           return newMessages;
// //         });
// //       } else {
// //         // Если сообщение из другой комнаты — обновляем список комнат (счётчик непрочитанных)
// //         loadRooms();
// //       }
// //     });

// //     socket.on('error', (e) => console.error('socket error', e));

// //     return () => socket.disconnect();
// //   }, [user, currentRoom]); // eslint-disable-line react-hooks/exhaustive-deps

//   // Переключение комнаты
//   const switchRoom = (roomId) => {
//     if (roomId === currentRoom) return;

//     if (socketRef.current) {
//       socketRef.current.emit('leave', currentRoom);
//       socketRef.current.emit('join', roomId);
//     }

//     setCurrentRoom(roomId);
//     setMessages([]);
//     setSidebarOpen(false);

//     // Загружаем историю и отмечаем как прочитанное
//     loadMessages(roomId);
//   };

//   // Создание комнаты
//   const createRoom = () => {
//     const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');
//     if (!name) return;
//     if (!/^[a-z0-9-]+$/.test(name)) {
//       alert('Только латиница, цифры и дефис');
//       return;
//     }
//     switchRoom(name);
//     setNewRoomName('');
//     setShowNewRoomInput(false);
//   };

//   // Отправка сообщения
//     const send = () => {
//     if (!text.trim() || !socketRef.current) return;
    
//     socketRef.current.emit('sendMessage', {
//       roomId: currentRoom,
//       text: text.trim(),
//     });
    
//     setText('');
    
//     // Сбрасываем таймер и статус при отправке
//     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//     socketRef.current.emit('stopTyping', { roomId: currentRoom, username: user.username });
//     setTypingUsers([]); // На всякий случай очищаем локальный список
//   };
// //   const send = () => {
// //     if (!text.trim() || !socketRef.current) return;
// //     socketRef.current.emit('sendMessage', {
// //       roomId: currentRoom,
// //       text: text.trim(),
// //     });
// //     setText('');
// //   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       send();
//     }
//   };

//   if (loading || !user) {
//     return (
//       <div className="min-vh-100 d-flex align-items-center justify-content-center">
//         <div className="spinner-border text-primary" role="status">
//           <span className="visually-hidden">Загрузка...</span>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-vh-100 bg-body d-flex flex-column">
//       {/* Header */}
//       <nav className="navbar navbar-dark bg-primary shadow-sm">
//         <div className="container-fluid">
//           <button
//             className="btn btn-link  d-lg-none p-0 me-2"
//             onClick={() => setSidebarOpen(!sidebarOpen)}
//           >
//             ☰
//           </button>
//           <span className="navbar-brand mb-0 h1">💬 Chat</span>
//           <div className="d-flex align-items-center gap-3">
//             <span className="navbar-text ">👤 {user.username}</span>
//             <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
//               {isConnected ? 'Online' : 'Offline'}
//             </span>
//             <div className="form-check form-switch">
//               <input
//                 className="form-check-input"
//                 type="checkbox"
//                 id="themeSwitch"
//                 checked={theme === 'dark'}
//                 onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
//               />
//               <label className="form-check-label " htmlFor="themeSwitch">
//                 {theme === 'dark' ? '🌙' : '☀️'}
//               </label>
//             </div>
//             <button className="btn btn-outline-light btn-sm" onClick={logout}>
//               Выйти
//             </button>
//           </div>
//         </div>
//       </nav>

//       {/* Main */}
//       <div className="container-fluid flex-grow-1 py-3">
//         <div className="row g-3">
//           {/* Sidebar */}
//           <div className={`col-lg-3 ${sidebarOpen ? 'd-block' : 'd-none d-lg-block'}`}>
//             <div className="card shadow-sm sticky-top" style={{ top: '1rem' }}>
//               <div className="card-header  d-flex justify-content-between align-items-center">
//                 <h6 className="mb-0">Комнаты</h6>
//                 <button
//                   className="btn btn-sm btn-primary"
//                   onClick={() => setShowNewRoomInput(!showNewRoomInput)}
//                 >
//                   +
//                 </button>
//               </div>

//               {showNewRoomInput && (
//                 <div className="card-body border-bottom p-2">
//                   <div className="input-group input-group-sm">
//                     <input
//                       type="text"
//                       className="form-control"
//                       placeholder="название-комнаты"
//                       value={newRoomName}
//                       onChange={(e) => setNewRoomName(e.target.value)}
//                       onKeyDown={(e) => e.key === 'Enter' && createRoom()}
//                       autoFocus
//                     />
//                     <button className="btn btn-success" onClick={createRoom}>
//                       ✓
//                     </button>
//                   </div>
//                 </div>
//               )}

//               <div
//                 className="list-group list-group-flush"
//                 style={{ maxHeight: '70vh', overflowY: 'auto' }}
//               >
//                 {rooms.map((r) => (
//                   <button
//                     key={r.roomId}
//                     className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
//                       currentRoom === r.roomId ? 'active' : ''
//                     }`}
//                     onClick={() => switchRoom(r.roomId)}
//                   >
//                     <span># {r.roomId}</span>
//                     {r.unreadCount > 0 && currentRoom !== r.roomId && (
//                       <span className="badge bg-danger rounded-pill">
//                         {r.unreadCount}
//                       </span>
//                     )}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* Chat */}
//           <div className="col-lg-9">
//             <div className="card shadow-sm">
//               <div className="card-header  py-3">
//                 <h5 className="mb-0 text-primary"># {currentRoom}</h5>
//               </div>

//               <div
//                 className="card-body bg-body"
//                 style={{ height: '60vh', overflowY: 'auto' }}
//               >
//                 {messages.length === 0 ? (
//                   <div className="text-center text-muted py-5">
//                     <p className="mb-0">Пока нет сообщений</p>
//                     <small>Напишите первое!</small>
//                   </div>
//                 ) : (
//                   messages.map((m) => (
//                     <div
//                       key={m.id}
//                       className={`mb-3 ${m.userId == user.id ? 'text-end' : 'text-start'}`}
//                     >
//                       <div
//                         className={`d-inline-block px-3 py-2 rounded-3 ${
//                           m.userId === user.id ? 'bg-primary ' : ' border'
//                         }`}
//                         style={{ maxWidth: '70%' }}
//                       >
//                         {m.userId !== user.id && (
//                           <small className="d-block text-primary mb-1 fw-bold">
//                             {m.username}
//                           </small>
//                         )}
//                         <p className="mb-1">{m.text}</p>
//                         <small
//                           className={m.userId === user.id ? '-50' : 'text-muted'}
//                         >
//                           {new Date(m.createdAt).toLocaleTimeString()}
//                         </small>
//                       </div>
//                     </div>
//                   ))
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>
//               {/* Индикатор "Печатает..." */}
//               {typingUsers.length > 0 && (
//                 <div className="px-3 pb-2">
//                   <small className="text-muted fst-italic">
//                     {typingUsers.length === 1 
//                       ? `✍️ ${typingUsers[0]} печатает...` 
//                       : `✍️ Печатают: ${typingUsers.join(', ')}`
//                     }
//                   </small>
//                 </div>
//               )}

//               <div className="card-footer">
//                 <div className="input-group">
//                   <input
//                     type="text"
//                     className="form-control form-control-lg"
//                     placeholder={`Сообщение в #${currentRoom}...`}
//                     value={text}
//                     onChange={handleInputChange} // <-- ЗАМЕНИТЕ onChange ЗДЕСЬ
//                     onKeyDown={handleKeyDown}
//                     disabled={!isConnected}
//                   />
//                   <button
//                     className="btn btn-primary btn-lg px-4"
//                     onClick={send}
//                     disabled={!isConnected || !text.trim()}
//                   >
//                     Отправить
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



// import { useEffect, useRef, useState } from 'react';
// import { useRouter } from 'next/router';
// import { io } from 'socket.io-client';
// import { useAuth } from '../lib/auth-context';

// export default function Home({ theme, setTheme }) {
//   const { user, loading, logout } = useAuth();
//   const router = useRouter();

//   const [rooms, setRooms] = useState([]);
//   const [currentRoom, setCurrentRoom] = useState('general');
//   const [messages, setMessages] = useState([]);
//   const [text, setText] = useState('');
//   const [isConnected, setIsConnected] = useState(false);
//   const [newRoomName, setNewRoomName] = useState('');
//   const [showNewRoomInput, setShowNewRoomInput] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   const socketRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   // Редирект если не авторизован
//   useEffect(() => {
//     if (!loading && !user) {
//       router.push('/login');
//     }
//   }, [user, loading, router]);

//   // Автопрокрутка
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const loadRooms = async () => {
//     try {
//       const res = await fetch('/api/rooms');
//       const data = await res.json();
//       setRooms(data.rooms || []);
//     } catch (e) {
//       console.error('loadRooms error', e);
//     }
//   };

//   const loadMessages = async (roomId) => {
//     try {
//       const res = await fetch(`/api/messages?roomId=${roomId}&limit=50`);
//       const data = await res.json();
//       setMessages(data.messages || []);
//     } catch (e) {
//       console.error('loadMessages error', e);
//     }
//   };

//   // Подключение к сокетам
//   useEffect(() => {
//     if (!user) return;

//     const token = localStorage.getItem('token');
//     const socket = io({
//       path: '/socket.io',
//       auth: { token },
//     });
//     socketRef.current = socket;

//     socket.on('connect', () => {
//       setIsConnected(true);
//       socket.emit('join', currentRoom);
//     });

//     socket.on('disconnect', () => {
//       setIsConnected(false);
//     });

//     socket.on('message', (msg) => {
//       if (msg.roomId === currentRoom) {
//         setMessages((prev) =>
//           prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
//         );
//         loadRooms();
//       }
//     });

//     socket.on('error', (e) => console.error('socket error', e));

//     return () => socket.disconnect();
//   }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

//   // Загрузка комнат и сообщений
//   useEffect(() => {
//     if (user) {
//       loadRooms();
//       loadMessages(currentRoom);
//     }
//   }, [user, currentRoom]);

//   const switchRoom = (roomId) => {
//     if (roomId === currentRoom) return;

//     if (socketRef.current) {
//       socketRef.current.emit('leave', currentRoom);
//       socketRef.current.emit('join', roomId);
//     }

//     setCurrentRoom(roomId);
//     setMessages([]);
//     setSidebarOpen(false);
//   };

//   const createRoom = () => {
//     const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');
//     if (!name) return;
//     if (!/^[a-z0-9-]+$/.test(name)) {
//       alert('Только латиница, цифры и дефис');
//       return;
//     }
//     switchRoom(name);
//     setNewRoomName('');
//     setShowNewRoomInput(false);
//   };

//   const send = () => {
//     if (!text.trim() || !socketRef.current) return;
//     socketRef.current.emit('sendMessage', {
//       roomId: currentRoom,
//       text: text.trim(),
//     });
//     setText('');
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       send();
//     }
//   };

//   const getRoomBadge = (roomId) => {
//     const room = rooms.find((r) => r.roomId === roomId);
//     return room ? room.messageCount : 0;
//   };

//   if (loading || !user) {
//     return (
//       <div className="min-vh-100 d-flex align-items-center justify-content-center">
//         <div className="spinner-border text-primary" role="status">
//           <span className="visually-hidden">Загрузка...</span>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-vh-100 bg-body d-flex flex-column">
//       {/* Header */}
//       <nav className="navbar navbar-dark bg-primary shadow-sm">
//         <div className="container-fluid">
//           <button
//             className="btn btn-link  d-lg-none p-0 me-2"
//             onClick={() => setSidebarOpen(!sidebarOpen)}
//           >
//             ☰
//           </button>
//           <span className="navbar-brand mb-0 h1">💬 Chat</span>
//           <div className="d-flex align-items-center gap-3">
//             <span className="navbar-text ">
//               👤 {user.username}
//             </span>
//             <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
//               {isConnected ? 'Online' : 'Offline'}
//             </span>
//             <div className="form-check form-switch">
//               <input
//                 className="form-check-input"
//                 type="checkbox"
//                 id="themeSwitch"
//                 checked={theme === 'dark'}
//                 onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
//               />
//               <label className="form-check-label " htmlFor="themeSwitch">
//                 {theme === 'dark' ? '🌙' : '☀️'}
//               </label>
//             </div>
//             <button className="btn btn-outline-light btn-sm" onClick={logout}>
//               Выйти
//             </button>
//           </div>
//         </div>
//       </nav>

//       {/* Main */}
//       <div className="container-fluid flex-grow-1 py-3">
//         <div className="row h-100 g-3">
//           {/* Sidebar */}
//           <div className={`col-lg-3 ${sidebarOpen ? 'd-block' : 'd-none d-lg-block'}`}>
//             <div className="card shadow-sm sticky-top" style={{ top: '1rem' }}>
//               <div className="card-header  d-flex justify-content-between align-items-center">
//                 <h6 className="mb-0">Комнаты</h6>
//                 <button
//                   className="btn btn-sm btn-primary"
//                   onClick={() => setShowNewRoomInput(!showNewRoomInput)}
//                 >
//                   +
//                 </button>
//               </div>

//               {showNewRoomInput && (
//                 <div className="card-body border-bottom p-2">
//                   <div className="input-group input-group-sm">
//                     <input
//                       type="text"
//                       className="form-control"
//                       placeholder="название-комнаты"
//                       value={newRoomName}
//                       onChange={(e) => setNewRoomName(e.target.value)}
//                       onKeyDown={(e) => e.key === 'Enter' && createRoom()}
//                       autoFocus
//                     />
//                     <button className="btn btn-success" onClick={createRoom}>
//                       ✓
//                     </button>
//                   </div>
//                 </div>
//               )}

//               <div className="list-group list-group-flush" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
//                 <button
//                   className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
//                     currentRoom === 'general' ? 'active' : ''
//                   }`}
//                   onClick={() => switchRoom('general')}
//                 >
//                   <span># general</span>
//                   {getRoomBadge('general') > 0 && currentRoom !== 'general' && (
//                     <span className="badge bg-secondary rounded-pill">
//                       {getRoomBadge('general')}
//                     </span>
//                   )}
//                 </button>

//                 {rooms
//                   .filter((r) => r.roomId !== 'general')
//                   .map((r) => (
//                     <button
//                       key={r.roomId}
//                       className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
//                         currentRoom === r.roomId ? 'active' : ''
//                       }`}
//                       onClick={() => switchRoom(r.roomId)}
//                     >
//                       <span># {r.roomId}</span>
//                       {currentRoom !== r.roomId && (
//                         <span className="badge bg-secondary rounded-pill">
//                           {r.messageCount}
//                         </span>
//                       )}
//                     </button>
//                   ))}
//               </div>
//             </div>
//           </div>

//           {/* Chat */}
//           <div className="col-lg-9">
//             <div className="card shadow-sm">
//               <div className="card-header  py-3">
//                 <h5 className="mb-0 text-primary"># {currentRoom}</h5>
//               </div>

//               <div
//                 className="card-body bg-body"
//                 style={{ height: '60vh', overflowY: 'auto' }}
//               >
//                 {messages.length === 0 ? (
//                   <div className="text-center text-muted py-5">
//                     <p className="mb-0">Пока нет сообщений</p>
//                     <small>Напишите первое!</small>
//                   </div>
//                 ) : (
//                   messages.map((m) => (
//                     <div
//                       key={m.id}
//                       className={`mb-3 ${m.userId === user.id ? 'text-end' : 'text-start'}`}
//                     >
//                       <div
//                         className={`d-inline-block px-3 py-2 rounded-3 ${
//                           m.userId === user.id
//                             ? 'bg-primary '
//                             : 'bg-body border'
//                         }`}
//                         style={{ maxWidth: '70%' }}
//                       >
//                         {m.userId !== user.id && (
//                           <small className="d-block text-primary mb-1 fw-bold">
//                             {m.username}
//                           </small>
//                         )}
//                         <p className="mb-1">{m.text}</p>
//                         <small className={m.userId === user.id ? 'text-blue-50' : 'text-muted'}>
//                           {new Date(m.createdAt).toLocaleTimeString()}
//                         </small>
//                       </div>
//                     </div>
//                   ))
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               <div className="card-footer ">
//                 <div className="input-group">
//                   <input
//                     type="text"
//                     className="form-control form-control-lg"
//                     placeholder={`Сообщение в #${currentRoom}...`}
//                     value={text}
//                     onChange={(e) => setText(e.target.value)}
//                     onKeyDown={handleKeyDown}
//                     disabled={!isConnected}
//                   />
//                   <button
//                     className="btn btn-primary btn-lg px-4"
//                     onClick={send}
//                     disabled={!isConnected || !text.trim()}
//                   >
//                     Отправить
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


// import { useEffect, useRef, useState } from 'react';
// import { io } from 'socket.io-client';

// const USER_ID = 'user-1';
// const USERNAME = 'Alice';

// export default function Home({ theme, setTheme }) {
//   const [rooms, setRooms] = useState([]);
//   const [currentRoom, setCurrentRoom] = useState('general');
//   const [messages, setMessages] = useState([]);
//   const [text, setText] = useState('');
//   const [isConnected, setIsConnected] = useState(false);
//   const [newRoomName, setNewRoomName] = useState('');
//   const [showNewRoomInput, setShowNewRoomInput] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false); // для мобильных
  
//   const socketRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   // Автопрокрутка
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Загрузка списка комнат
//   const loadRooms = async () => {
//     try {
//       const res = await fetch('/api/rooms');
//       const data = await res.json();
//       setRooms(data.rooms || []);
//     } catch (e) {
//       console.error('loadRooms error', e);
//     }
//   };

//   // Загрузка истории комнаты
//   const loadMessages = async (roomId) => {
//     try {
//       const res = await fetch(`/api/messages?roomId=${roomId}&limit=50`);
//       const data = await res.json();
//       setMessages(data.messages || []);
//     } catch (e) {
//       console.error('loadMessages error', e);
//     }
//   };

//   // Инициализация
//   useEffect(() => {
//     loadRooms();
//     loadMessages(currentRoom);

//     const socket = io({ path: '/socket.io' });
//     socketRef.current = socket;

//     socket.on('connect', () => {
//       setIsConnected(true);
//       socket.emit('join', currentRoom);
//     });

//     socket.on('disconnect', () => {
//       setIsConnected(false);
//     });

//     socket.on('message', (msg) => {
//       // Принимаем только сообщения из ТЕКУЩЕЙ комнаты
//       if (msg.roomId === currentRoom) {
//         setMessages((prev) =>
//           prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
//         );
//         // Обновляем список комнат (новая активность)
//         loadRooms();
//       }
//     });

//     socket.on('error', (e) => console.error('socket error', e));

//     return () => socket.disconnect();
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   // Смена комнаты
//   const switchRoom = (roomId) => {
//     if (roomId === currentRoom) return;

//     // 1) Говорим сокету выйти из старой и войти в новую
//     if (socketRef.current) {
//       socketRef.current.emit('leave', currentRoom);
//       socketRef.current.emit('join', roomId);
//     }

//     // 2) Меняем состояние
//     setCurrentRoom(roomId);
//     setMessages([]); // очищаем старые сообщения
//     setSidebarOpen(false); // закрываем сайдбар на мобильных

//     // 3) Подгружаем историю новой комнаты
//     loadMessages(roomId);
//   };

//   // Создание новой комнаты (просто отправляем первое сообщение)
//   const createRoom = () => {
//     const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');
//     if (!name) return;
//     if (!/^[a-z0-9-]+$/.test(name)) {
//       alert('Только латиница, цифры и дефис');
//       return;
//     }
//     switchRoom(name);
//     setNewRoomName(name);
//     setShowNewRoomInput(true);
//   };

//   const send = () => {
//     if (!text.trim() || !socketRef.current) return;
//     socketRef.current.emit('sendMessage', {
//       roomId: currentRoom,
//       userId: USER_ID,
//       username: USERNAME,
//       text: text.trim(),
//     });
//     setText('');
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       send();
//     }
//   };

//   // Счётчик непрочитанных (упрощённо — просто число сообщений)
//   const getRoomBadge = (roomId) => {
//     const room = rooms.find((r) => r.roomId === roomId);
//     return room ? room.messageCount : 0;
//   };

//   return (
//     <div className="min-vh-100 bg-body d-flex flex-column">
//       {/* Header */}
//       <nav className="navbar navbar-dark bg-primary shadow-sm">
//         <div className="container-fluid">
//           <button
//             className="btn btn-link  d-lg-none p-0 me-2"
//             onClick={() => setSidebarOpen(!sidebarOpen)}
//           >
//             ☰
//           </button>
//           <span className="navbar-brand mb-0 h1">💬 Chat</span>
//           <span className="navbar-text">
//             <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'} me-2`}>
//               {isConnected ? 'Online' : 'Offline'}
//             </span>
//           </span>
//             {/* Переключатель темы */}
//            <div className="form-check form-switch">
//              <input
//               className="form-check-input"
//               type="checkbox"
//               id="themeSwitch"
//               checked={theme === 'dark'}
//               onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
//             />
//             <label className="form-check-label " htmlFor="themeSwitch">
//               {theme === 'dark' ? '🌙' : '☀️'}
//             </label>
//           </div>
//         </div>

        
//       </nav>

//       {/* Main layout */}
//       <div className="container-fluid flex-grow-1 py-3">
//         <div className="row h-100 g-3">
          
//           {/* Sidebar */}
//           <div className={`col-lg-3 ${sidebarOpen ? 'd-block' : 'd-none d-lg-block'}`}>
//             <div className="card shadow-sm sticky-top" style={{ top: '1rem' }}>
//               <div className="card-header  d-flex justify-content-between align-items-center">
//                 <h6 className="mb-0">Комнаты</h6>
//                 <button
//                   className="btn btn-sm btn-primary"
//                   onClick={() => setShowNewRoomInput(!showNewRoomInput)}
//                   title="Создать комнату"
//                 >
//                   +
//                 </button>
//               </div>

//               {/* Форма создания */}
//               {showNewRoomInput && (
//                 <div className="card-body border-bottom p-2">
//                   <div className="input-group input-group-sm">
//                     <input
//                       type="text"
//                       className="form-control"
//                       placeholder="название-комнаты"
//                       value={newRoomName}
//                       onChange={(e) => setNewRoomName(e.target.value)}
//                       onKeyDown={(e) => e.key === 'Enter' && createRoom()}
//                       autoFocus
//                     />
//                     <button className="btn btn-success" onClick={createRoom}>
//                       ✓
//                     </button>
//                   </div>
//                   <small className="text-muted">Только a-z, 0-9, -</small>
//                 </div>
//               )}

//               {/* Список комнат */}
//               <div className="list-group list-group-flush" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
//                 {/* Всегда показываем general, даже если пуста */}
//                 <button
//                   className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
//                     currentRoom === 'general' ? 'active' : ''
//                   }`}
//                   onClick={() => switchRoom('general')}
//                 >
//                   <span># general</span>
//                   {getRoomBadge('general') > 0 && currentRoom !== 'general' && (
//                     <span className="badge bg-secondary rounded-pill">
//                       {getRoomBadge('general')}
//                     </span>
//                   )}
//                 </button>

//                 {rooms
//                   .filter((r) => r.roomId !== 'general')
//                   .map((r) => (
//                     <button
//                       key={r.roomId}
//                       className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
//                         currentRoom === r.roomId ? 'active' : ''
//                       }`}
//                       onClick={() => switchRoom(r.roomId)}
//                     >
//                       <span># {r.roomId}</span>
//                       {currentRoom !== r.roomId && (
//                         <span className="badge bg-secondary rounded-pill">
//                           {r.messageCount}
//                         </span>
//                       )}
//                     </button>
//                   ))}
//               </div>
//             </div>
//           </div>

//           {/* Chat area */}
//           <div className="col-lg-9">
//             <div className="card shadow-sm">
//               <div className="card-header  py-3">
//                 <h5 className="mb-0 text-primary">
//                   # {currentRoom}
//                 </h5>
//               </div>

//               {/* Messages */}
//               <div
//                 className="card-body bg-body"
//                 style={{ height: '60vh', overflowY: 'auto' }}
//               >
//                 {messages.length === 0 ? (
//                   <div className="text-center text-muted py-5">
//                     <p className="mb-0">Пока нет сообщений</p>
//                     <small>Напишите первое!</small>
//                   </div>
//                 ) : (
//                   messages.map((m) => (
//                     <div
//                       key={m.id}
//                       className={`mb-3 ${m.userId === USER_ID ? 'text-end' : 'text-start'}`}
//                     >
//                       <div
//                         className={`d-inline-block px-3 py-2 rounded-3 ${
//                           m.userId === USER_ID
//                             ? 'bg-primary '
//                             : ' border'
//                         }`}
//                         style={{ maxWidth: '70%' }}
//                       >
//                         {m.userId !== USER_ID && (
//                           <small className="d-block text-primary mb-1 fw-bold">
//                             {m.username}
//                           </small>
//                         )}
//                         <p className="mb-1">{m.text}</p>
//                         <small className={m.userId === USER_ID ? '-50' : 'text-muted'}>
//                           {new Date(m.createdAt).toLocaleTimeString()}
//                         </small>
//                       </div>
//                     </div>
//                   ))
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               {/* Input */}
//               <div className="card-footer ">
//                 <div className="input-group">
//                   <input
//                     type="text"
//                     className="form-control form-control-lg"
//                     placeholder={`Сообщение в #${currentRoom}...`}
//                     value={text}
//                     onChange={(e) => setText(e.target.value)}
//                     onKeyDown={handleKeyDown}
//                     disabled={!isConnected}
//                   />
//                   <button
//                     className="btn btn-primary btn-lg px-4"
//                     onClick={send}
//                     disabled={!isConnected || !text.trim()}
//                   >
//                     Отправить
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>

//         </div>
//       </div>
//     </div>
//   );
// }






// import { useEffect, useRef, useState } from 'react';
// import { io } from 'socket.io-client';

// const ROOM_ID = 'general';
// const USER_ID = 'user-1';
// const USERNAME = 'Alice';

// export default function Home({ theme, setTheme }) {
//   const [messages, setMessages] = useState([]);
//   const [text, setText] = useState('');
//   const [isConnected, setIsConnected] = useState(false);
//   const socketRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   // Автопрокрутка вниз
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Загрузка истории
//   useEffect(() => {
//     fetch(`/api/messages?roomId=${ROOM_ID}&limit=50`)
//       .then((r) => r.json())
//       .then((data) => setMessages(data.messages || []))
//       .catch(console.error);
//   }, []);

//   // Подключение к сокетам
//   useEffect(() => {
//     const socket = io({ path: '/socket.io' });
//     socketRef.current = socket;

//     socket.on('connect', () => {
//       setIsConnected(true);
//       socket.emit('join', ROOM_ID);
//     });

//     socket.on('disconnect', () => {
//       setIsConnected(false);
//     });

//     socket.on('message', (msg) => {
//       setMessages((prev) =>
//         prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
//       );
//     });

//     socket.on('error', (e) => console.error('socket error', e));

//     return () => socket.disconnect();
//   }, []);

//   const send = () => {
//     if (!text.trim() || !socketRef.current) return;
//     socketRef.current.emit('sendMessage', {
//       roomId: ROOM_ID,
//       userId: USER_ID,
//       username: USERNAME,
//       text: text.trim(),
//     });
//     setText('');
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       send();
//     }
//   };

//   return (
//     <div className="min-vh-80">
//       {/* Header */}
//       <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
//         <div className="container">
//           <span className="navbar-brand mb-0 h1">
//             💬 Chat
//           </span>
//           <span className="navbar-text">
//             <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'} me-2`}>
//               {isConnected ? 'Online' : 'Offline'}
//             </span>
//             <span className="-50">Комната: <strong>{ROOM_ID}</strong></span>
//           </span>
//         </div>
//       </nav>

//       {/* Main */}
//       <div className="container py-4">
//         <div className="row justify-content-center">
//           <div className="col-lg-8 col-md-10">
            
//             {/* Chat Card */}
//             <div className="card shadow">
//               <div className="card-header bg-gray py-3">
//                 <h5 className="mb-0 text-primary">
//                   📝 Сообщения
//                 </h5>
//               </div>
              
//               {/* Messages Area */}
//               <div 
//                 className="card-body"
//                 style={{ height: '500px', overflowY: 'auto' }}
//               >
//                 {messages.length === 0 ? (
//                   <div className="text-center text-muted py-5">
//                     <p className="mb-0">Нет сообщений</p>
//                     <small>Будьте первым!</small>
//                   </div>
//                 ) : (
//                   messages.map((m) => (
//                     <div
//                       key={m.id}
//                       className={`mb-3 ${m.userId === USER_ID ? 'text-end' : 'text-start'}`}
//                     >
//                       <div
//                         className={`d-inline-block px-3 py-2 rounded-3 ${
//                           m.userId === USER_ID
//                             ? 'bg-primary '
//                             : ' border'
//                         }`}
//                         style={{ maxWidth: '70%' }}
//                       >
//                         {m.userId !== USER_ID && (
//                           <small className="d-block text-primary mb-1 fw-bold">
//                             {m.username}
//                           </small>
//                         )}
//                         <p className="mb-1">{m.text}</p>
//                         <small className={m.userId === USER_ID ? '-50' : 'text-muted'}>
//                           {new Date(m.createdAt).toLocaleTimeString()}
//                         </small>
//                       </div>
//                     </div>
//                   ))
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               {/* Input Area */}
//               <div className="card-footer bg-blue">
                          
//           {/* Переключатель темы */}
//           <div className="form-check form-switch">
//             <input
//               className="form-check-input"
//               type="checkbox"
//               id="themeSwitch"
//               checked={theme === 'dark'}
//               onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
//             />
//             <label className="form-check-label " htmlFor="themeSwitch">
//               {theme === 'dark' ? '🌙' : '☀️'}
//             </label>
//           </div>
//                 <div className="input-group">
//                   <input
//                     type="text"
//                     className="form-control form-control-lg"
//                     placeholder="Введите сообщение..."
//                     value={text}
//                     onChange={(e) => setText(e.target.value)}
//                     onKeyDown={handleKeyDown}
//                     disabled={!isConnected}
//                   />
//                   <button
//                     className="btn btn-primary btn-lg px-4"
//                     onClick={send}
//                     disabled={!isConnected || !text.trim()}
//                   >
//                     Отправить
//                   </button>
//                 </div>
//                 <small className="text-muted mt-2 d-block">
//                   Нажмите Enter для отправки
//                 </small>
//               </div>
//             </div>

//             {/* Stats */}
//             <div className="row mt-3">
//               <div className="col-6">
//                 <div className="card text-center">
//                   <div className="card-body py-2">
//                     <h6 className="text-muted mb-0">Сообщений</h6>
//                     <h3 className="mb-0 text-primary">{messages.length}</h3>
//                   </div>
//                 </div>
//               </div>
//               <div className="col-6">
//                 <div className="card text-center">
//                   <div className="card-body py-2">
//                     <h6 className="text-muted mb-0">Комната</h6>
//                     <h6 className="mb-0 text-success">{ROOM_ID}</h6>
//                   </div>
//                 </div>
//               </div>
//             </div>

//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }