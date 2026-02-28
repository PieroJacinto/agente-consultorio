// scripts/crear-admin.js
// Correr UNA SOLA VEZ para crear el primer usuario del dashboard
// Uso: node scripts/crear-admin.js
// Personalizar: ADMIN_EMAIL=miemail@gmail.com ADMIN_PASS=MiPassword123 node scripts/crear-admin.js

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  const email    = process.env.ADMIN_EMAIL  || 'admin@consultorio.com'
  const password = process.env.ADMIN_PASS   || 'Admin1234!'
  const nombre   = process.env.ADMIN_NOMBRE || 'Administrador'
  const clienteId = process.env.CLIENTE_ID  || 'demo'

  const hash = await bcrypt.hash(password, 10)

  try {
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

    const { rows } = await pool.query(`
      INSERT INTO usuarios (cliente_id, nombre, email, password_hash, rol)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = $4, nombre = $2
      RETURNING id, nombre, email, rol
    `, [clienteId, nombre, email, hash])

    console.log('✅ Usuario creado:')
    console.log(`   Email:    ${rows[0].email}`)
    console.log(`   Password: ${password}`)
    console.log(`   Rol:      ${rows[0].rol}`)
    console.log(`   Cliente:  ${clienteId}`)
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await pool.end()
  }
}

main()