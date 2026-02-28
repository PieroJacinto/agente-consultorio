// scripts/crear-admin.js
// Crea el primer usuario admin Y el cliente en la DB
// Uso: node scripts/crear-admin.js
// Personalizar con variables de entorno:
//   CLIENTE_ID=demo CLIENTE_NOMBRE="Consultorio Dra. García" ADMIN_EMAIL=... ADMIN_PASS=... node scripts/crear-admin.js

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  // ── Datos del cliente (consultorio) ──
  const clienteId   = process.env.CLIENTE_ID     || 'demo'
  const clienteNom  = process.env.CLIENTE_NOMBRE || 'Consultorio Dra. García'
  const especialidad= process.env.ESPECIALIDAD   || 'Medicina General'
  const direccion   = process.env.DIRECCION      || 'Av. Corrientes 1234, CABA'
  const telefono    = process.env.TELEFONO        || '+54 11 4567-8900'
  const duracion    = parseInt(process.env.DURACION_MIN) || 30
  const horInicio   = process.env.HORARIO_INICIO  || '09:00'
  const horFin      = process.env.HORARIO_FIN     || '18:00'
  const obrasSoc    = process.env.OBRAS_SOCIALES
    ? process.env.OBRAS_SOCIALES.split(',')
    : ['OSDE', 'Swiss Medical', 'Galeno', 'IOMA', 'PAMI', 'Medicus']
  const valorPart   = process.env.VALOR_PARTICULAR || '$20.000'

  // ── Datos del usuario admin ──
  const email    = process.env.ADMIN_EMAIL  || 'admin@consultorio.com'
  const password = process.env.ADMIN_PASS   || 'Admin1234!'
  const nombre   = process.env.ADMIN_NOMBRE || 'Administrador'

  const hash = await bcrypt.hash(password, 10)

  try {
    // Crear tablas si no existen
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

    // Crear o actualizar cliente
    await pool.query(`
      INSERT INTO clientes (
        id, nombre, especialidad, direccion, telefono,
        horario_lunes_viernes, horario_sabados, horario_domingos,
        duracion_turno_minutos, horario_inicio, horario_fin,
        obras_sociales, valor_consulta_particular, formas_de_pago
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        nombre=$2, especialidad=$3, duracion_turno_minutos=$9,
        horario_inicio=$10, horario_fin=$11, obras_sociales=$12
    `, [
      clienteId, clienteNom, especialidad, direccion, telefono,
      `${horInicio} a ${horFin}`, '9:00 a 13:00', 'cerrado',
      duracion, horInicio, horFin,
      JSON.stringify(obrasSoc), valorPart,
      JSON.stringify(['Efectivo', 'Transferencia bancaria', 'Mercado Pago'])
    ])

    // Crear o actualizar usuario admin
    const { rows } = await pool.query(`
      INSERT INTO usuarios (cliente_id, nombre, email, password_hash, rol)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = $4, nombre = $2
      RETURNING id, nombre, email, rol
    `, [clienteId, nombre, email, hash])

    console.log('\n✅ Setup completo:')
    console.log(`   Consultorio: ${clienteNom} (ID: ${clienteId})`)
    console.log(`   Turnos de ${duracion} min | ${horInicio} a ${horFin}`)
    console.log(`   Obras sociales: ${obrasSoc.join(', ')}`)
    console.log(`\n   Usuario admin:`)
    console.log(`   Email:    ${rows[0].email}`)
    console.log(`   Password: ${password}`)
    console.log(`   Rol:      ${rows[0].rol}`)
    console.log(`\n   Dashboard: http://localhost:3000/dashboard`)
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await pool.end()
  }
}

main()