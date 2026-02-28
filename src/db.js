const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function inicializarDB() {
  // Tabla original de turnos — sin cambios
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

  // Columna origen: puede no existir en instancias viejas, la agregamos si falta
  await pool.query(`
    ALTER TABLE turnos ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'agente'`)
  await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS cargado_por VARCHAR(200)
  `)

  // Tabla de usuarios del dashboard (secretaria, médico, admin)
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

// ─── FUNCIONES ORIGINALES (sin cambios) ──────────────────────────────────────

async function horarioDisponible(clienteId, horario) {
  const result = await pool.query(
    `SELECT id FROM turnos 
     WHERE cliente_id = $1 AND horario = $2 AND estado != 'cancelado'`,
    [clienteId, horario]
  )
  return result.rows.length === 0
}

async function guardarTurno(turno) {
  const { clienteId, nombre, telefono, obraSocial, fecha, horario } = turno

  const disponible = await horarioDisponible(clienteId, horario)
  if (!disponible) {
    throw new Error(`HORARIO_OCUPADO:${horario}`)
  }

  const result = await pool.query(
    `INSERT INTO turnos (cliente_id, paciente_nombre, paciente_telefono, obra_social, fecha_turno, horario, origen)
     VALUES ($1, $2, $3, $4, $5, $6, 'agente')
     RETURNING *`,
    [clienteId, nombre, telefono, obraSocial, fecha, horario]
  )
  return result.rows[0]
}

async function getTurnosPorCliente(clienteId) {
  const result = await pool.query(
    `SELECT * FROM turnos WHERE cliente_id = $1 ORDER BY created_at DESC`,
    [clienteId]
  )
  return result.rows
}

// ─── FUNCIONES NUEVAS PARA EL DASHBOARD ──────────────────────────────────────

// Obtener turnos filtrados por fecha o rango de semana
async function getTurnosFiltrados({ clienteId, fecha, semana }) {
  if (fecha) {
    // Vista del día: busca por fecha_turno que contenga la fecha (ej: "lunes 2026-03-02")
    // También soporta buscar directamente si fecha_turno es exactamente la fecha
    const result = await pool.query(
      `SELECT * FROM turnos
       WHERE cliente_id = $1
         AND fecha_turno = $2
         AND estado != 'cancelado'
       ORDER BY horario ASC`,
      [clienteId, fecha]
    )
    return result.rows
  }

  if (semana) {
    // Vista semanal: recibe fecha inicio de semana (lunes), trae los 6 días
    const result = await pool.query(
      `SELECT * FROM turnos
       WHERE cliente_id = $1
         AND fecha_turno >= $2
         AND fecha_turno <= $3
         AND estado != 'cancelado'
       ORDER BY fecha_turno ASC, horario ASC`,
      [clienteId, semana.inicio, semana.fin]
    )
    return result.rows
  }

  // Sin filtro: todos los turnos del cliente
  return getTurnosPorCliente(clienteId)
}

// Agregar turno manual desde la secretaria
async function guardarTurnoManual({ clienteId, nombre, dni, obraSocial, afiliado, motivo, fecha, horario, telefono, cargadoPor }) {
  const result = await pool.query(
    `INSERT INTO turnos (cliente_id, paciente_nombre, paciente_dni, paciente_telefono, obra_social, numero_afiliado, motivo, fecha_turno, horario, origen, cargado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'secretaria', $10)
     RETURNING *`,
    [clienteId, nombre, dni || '', telefono || '', obraSocial || '', afiliado || '', motivo || '', fecha, horario, cargadoPor || '']
  )
  return result.rows[0]
}

// Cancelar turno por ID
async function cancelarTurno(id, clienteId) {
  const result = await pool.query(
    `UPDATE turnos SET estado = 'cancelado'
     WHERE id = $1 AND cliente_id = $2
     RETURNING *`,
    [id, clienteId]
  )
  if (result.rows.length === 0) throw new Error('Turno no encontrado')
  return result.rows[0]
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

async function crearUsuario({ clienteId, nombre, email, passwordHash, rol = 'secretaria' }) {
  const result = await pool.query(
    `INSERT INTO usuarios (cliente_id, nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, cliente_id, nombre, email, rol`,
    [clienteId, nombre, email, passwordHash, rol]
  )
  return result.rows[0]
}

async function buscarUsuarioPorEmail(email) {
  const result = await pool.query(
    `SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE`,
    [email]
  )
  return result.rows[0] || null
}

module.exports = {
  inicializarDB,
  guardarTurno,
  getTurnosPorCliente,
  horarioDisponible,
  // Nuevas para dashboard:
  getTurnosFiltrados,
  guardarTurnoManual,
  cancelarTurno,
  crearUsuario,
  buscarUsuarioPorEmail
}