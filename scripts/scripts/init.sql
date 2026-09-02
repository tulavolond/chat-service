CREATE DATABASE IF NOT EXISTS chat_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE chat_db;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(64)  NOT NULL UNIQUE,
  email        VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username)
) ENGINE=InnoDB;

-- Таблица сообщений (без изменений)
CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id    VARCHAR(64)  NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  username   VARCHAR(64)  NOT NULL,
  text       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_created (room_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS room_reads (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  room_id      VARCHAR(64) NOT NULL,
  last_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_room (user_id, room_id)
) ENGINE=InnoDB;

ALTER TABLE users 
ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL,
ADD COLUMN reset_token_expires DATETIME DEFAULT NULL;