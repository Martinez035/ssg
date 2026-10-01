-- SGG - Esquema relacional unificado (Autenticación + Gestión de Gastos)
-- Motor: MySQL 8.x
CREATE DATABASE IF NOT EXISTS sgg_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sgg_db;

CREATE TABLE usuarios (
  id_usuario     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  fecha_registro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE categorias (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(40)  NOT NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE gastos (
  id_gasto      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario    INT UNSIGNED  NOT NULL,
  id_categoria  INT UNSIGNED  NOT NULL,
  monto         DECIMAL(12,2) NOT NULL,
  fecha         DATE          NOT NULL,
  descripcion   VARCHAR(120)  NOT NULL,
  estado_activo TINYINT(1)    NOT NULL DEFAULT 1,  -- baja lógica: 1 activo, 0 inactivo
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_gasto),
  CONSTRAINT chk_gastos_monto CHECK (monto > 0),
  CONSTRAINT fk_gastos_usuario   FOREIGN KEY (id_usuario)   REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_gastos_categoria FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria),
  INDEX idx_gastos_usuario_estado (id_usuario, estado_activo)
) ENGINE=InnoDB;

INSERT INTO categorias (nombre) VALUES ('Alimentación'), ('Transporte'), ('Servicios'), ('Ocio');

-- Consulta equivalente a RF-06 / RF-09 (gastos activos de un usuario)
-- SELECT g.fecha, c.nombre, g.descripcion, g.monto
--   FROM gastos g JOIN categorias c ON c.id_categoria = g.id_categoria
--  WHERE g.id_usuario = 1 AND g.estado_activo = 1;
-- SELECT SUM(monto) AS total_gastado FROM gastos WHERE id_usuario = 1 AND estado_activo = 1;
