// src/db.js
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function inicializarDB() {

  // ── TABLA CLIENTES ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id VARCHAR(100) PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      especialidad VARCHAR(200),
      direccion VARCHAR(300),
      telefono VARCHAR(100),
      horario_lunes_viernes VARCHAR(100),
      horario_sabados VARCHAR(100),
      horario_domingos VARCHAR(100),
      duracion_turno_minutos INTEGER DEFAULT 30,
      horario_inicio VARCHAR(10) DEFAULT '09:00',
      horario_fin VARCHAR(10) DEFAULT '18:00',
      obras_sociales TEXT,
      valor_consulta_particular VARCHAR(100),
      formas_de_pago TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // ── TABLA TURNOS ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS turnos (
      id SERIAL PRIMARY KEY,
      cliente_id VARCHAR(100) NOT NULL,
      paciente_nombre VARCHAR(200) NOT NULL,
      paciente_telefono VARCHAR(50),
      obra_social VARCHAR(100),
      fecha_turno VARCHAR(50),
      horario VARCHAR(50),
      estado VARCHAR(20) DEFAULT 'pendiente',
      origen VARCHAR(20) DEFAULT 'agente',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Columnas que pueden no existir en instancias viejas
  const columnas = [
    `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'agente'`,
    `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS cargado_por VARCHAR(200)`,
    `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS paciente_dni VARCHAR(30)`,
    `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS motivo TEXT`,
    `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS numero_afiliado VARCHAR(100)`
  ]
  for (const sql of columnas) await pool.query(sql)

  // ── TABLA USUARIOS ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      cliente_id VARCHAR(100) NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      email VARCHAR(200) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(20) DEFAULT 'secretaria',
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  console.log('✅ Base de datos inicializada')
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

async function getClienteDB(clienteId) {
  const { rows } = await pool.query(
    `SELECT * FROM clientes WHERE id = $1 AND activo = TRUE`,
    [clienteId]
  )
  if (!rows[0]) return null

  const c = rows[0]
  // Reconstruir el objeto con la misma forma que tenía el JSON
  // para que prompts.js y el resto del código no necesiten cambios
  return {
    id:                       c.id,
    nombre:                   c.nombre,
    especialidad:             c.especialidad,
    direccion:                c.direccion,
    telefono:                 c.telefono,
    horarios: {
      lunes_viernes:          c.horario_lunes_viernes,
      sabados:                c.horario_sabados,
      domingos:               c.horario_domingos
    },
    duracion_turno_minutos:   c.duracion_turno_minutos,
    horario_inicio:           c.horario_inicio,
    horario_fin:              c.horario_fin,
    obras_sociales:           JSON.parse(c.obras_sociales  || '[]'),
    formas_de_pago:           JSON.parse(c.formas_de_pago  || '[]'),
    valor_consulta_particular: c.valor_consulta_particular,
    // Campo de texto para el prompt (ej: "30 minutos")
    duracion_turno:           `${c.duracion_turno_minutos} minutos`
  }
}

async function crearCliente(datos) {
  const {
    id, nombre, especialidad, direccion, telefono,
    horario_lunes_viernes, horario_sabados, horario_domingos,
    duracion_turno_minutos, horario_inicio, horario_fin,
    obras_sociales, valor_consulta_particular, formas_de_pago
  } = datos

  const { rows } = await pool.query(`
    INSERT INTO clientes (
      id, nombre, especialidad, direccion, telefono,
      horario_lunes_viernes, horario_sabados, horario_domingos,
      duracion_turno_minutos, horario_inicio, horario_fin,
      obras_sociales, valor_consulta_particular, formas_de_pago
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (id) DO UPDATE SET
      nombre = $2, especialidad = $3, direccion = $4, telefono = $5,
      horario_lunes_viernes = $6, horario_sabados = $7, horario_domingos = $8,
      duracion_turno_minutos = $9, horario_inicio = $10, horario_fin = $11,
      obras_sociales = $12, valor_consulta_particular = $13, formas_de_pago = $14
    RETURNING *`,
    [
      id, nombre, especialidad, direccion, telefono,
      horario_lunes_viernes, horario_sabados, horario_domingos,
      duracion_turno_minutos || 30,
      horario_inicio || '09:00',
      horario_fin    || '18:00',
      JSON.stringify(obras_sociales || []),
      valor_consulta_particular,
      JSON.stringify(formas_de_pago || [])
    ]
  )
  return rows[0]
}

// ── TURNOS ────────────────────────────────────────────────────────────────────

async function horarioDisponible(clienteId, horario) {
  const { rows } = await pool.query(
    `SELECT id FROM turnos
     WHERE cliente_id = $1 AND horario = $2 AND estado != 'cancelado'`,
    [clienteId, horario]
  )
  return rows.length === 0
}

async function guardarTurno(turno) {
  const { clienteId, nombre, telefono, obraSocial, fecha, horario } = turno

  const disponible = await horarioDisponible(clienteId, horario)
  if (!disponible) throw new Error(`HORARIO_OCUPADO:${horario}`)

  const { rows } = await pool.query(
    `INSERT INTO turnos (cliente_id, paciente_nombre, paciente_telefono, obra_social, fecha_turno, horario, origen)
     VALUES ($1, $2, $3, $4, $5, $6, 'agente')
     RETURNING *`,
    [clienteId, nombre, telefono, obraSocial, fecha, horario]
  )
  return rows[0]
}

async function getTurnosPorCliente(clienteId) {
  const { rows } = await pool.query(
    `SELECT * FROM turnos WHERE cliente_id = $1 ORDER BY created_at DESC`,
    [clienteId]
  )
  return rows
}

async function getTurnosFiltrados({ clienteId, fecha, semana }) {
  if (fecha) {
    const { rows } = await pool.query(
      `SELECT * FROM turnos
       WHERE cliente_id = $1 AND fecha_turno = $2 AND estado != 'cancelado'
       ORDER BY horario ASC`,
      [clienteId, fecha]
    )
    return rows
  }

  if (semana) {
    const { rows } = await pool.query(
      `SELECT * FROM turnos
       WHERE cliente_id = $1
         AND fecha_turno >= $2 AND fecha_turno <= $3
         AND estado != 'cancelado'
       ORDER BY fecha_turno ASC, horario ASC`,
      [clienteId, semana.inicio, semana.fin]
    )
    return rows
  }

  return getTurnosPorCliente(clienteId)
}

async function guardarTurnoManual({ clienteId, nombre, dni, obraSocial, afiliado, motivo, fecha, horario, telefono, cargadoPor }) {
  const { rows } = await pool.query(
    `INSERT INTO turnos
      (cliente_id, paciente_nombre, paciente_dni, paciente_telefono,
       obra_social, numero_afiliado, motivo, fecha_turno, horario, origen, cargado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'secretaria',$10)
     RETURNING *`,
    [clienteId, nombre, dni||'', telefono||'', obraSocial||'', afiliado||'', motivo||'', fecha, horario, cargadoPor||'']
  )
  return rows[0]
}

async function cancelarTurno(id, clienteId) {
  const { rows } = await pool.query(
    `UPDATE turnos SET estado = 'cancelado'
     WHERE id = $1 AND cliente_id = $2 RETURNING *`,
    [id, clienteId]
  )
  if (rows.length === 0) throw new Error('Turno no encontrado')
  return rows[0]
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────

async function crearUsuario({ clienteId, nombre, email, passwordHash, rol = 'secretaria' }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (cliente_id, nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, cliente_id, nombre, email, rol`,
    [clienteId, nombre, email, passwordHash, rol]
  )
  return rows[0]
}

async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE`,
    [email]
  )
  return rows[0] || null
}

module.exports = {
  inicializarDB,
  // Clientes:
  getClienteDB,
  crearCliente,
  // Turnos:
  guardarTurno,
  getTurnosPorCliente,
  getTurnosFiltrados,
  guardarTurnoManual,
  cancelarTurno,
  horarioDisponible,
  // Usuarios:
  crearUsuario,
  buscarUsuarioPorEmail
}