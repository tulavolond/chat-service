CREATE DATABASE IF NOT EXISTS chat_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE chat_db;

CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id    VARCHAR(64)  NOT NULL,
  user_id    VARCHAR(64)  NOT NULL,
  username   VARCHAR(128) NOT NULL,
  text       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_created (room_id, created_at)
) ENGINE=InnoDB;