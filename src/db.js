const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function inicializarDB() {
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
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('✅ Base de datos inicializada')
}

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
    `INSERT INTO turnos (cliente_id, paciente_nombre, paciente_telefono, obra_social, fecha_turno, horario)
     VALUES ($1, $2, $3, $4, $5, $6)
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

module.exports = { inicializarDB, guardarTurno, getTurnosPorCliente }