// scripts/migrar-clientes.js
// Corre UNA SOLA VEZ para pasar los clientes de JSON a PostgreSQL
// Uso: node scripts/migrar-clientes.js

require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  // Crear tabla si no existe (por si se corre antes de arrancar el servidor)
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

  const carpetaClientes = path.join(__dirname, '..', 'clientes')
  if (!fs.existsSync(carpetaClientes)) {
    console.log('⚠️  No existe la carpeta /clientes, nada que migrar.')
    await pool.end(); return
  }

  const carpetas = fs.readdirSync(carpetaClientes)
  let migrados = 0

  for (const carpeta of carpetas) {
    const rutaJson = path.join(carpetaClientes, carpeta, 'clinica.json')
    if (!fs.existsSync(rutaJson)) continue

    const c = JSON.parse(fs.readFileSync(rutaJson, 'utf-8'))
    const id = carpeta  // nombre de carpeta = clienteId

    // Parsear duración de turno si viene como texto ("30 minutos" → 30)
    let duracionMin = c.duracion_turno_minutos
    if (!duracionMin && c.duracion_turno) {
      duracionMin = parseInt(c.duracion_turno) || 30
    }
    duracionMin = duracionMin || 30

    // Horarios de atención
    const lv  = c.horarios?.lunes_viernes || '9:00 a 18:00'
    const sab = c.horarios?.sabados       || '9:00 a 13:00'
    const dom = c.horarios?.domingos      || 'cerrado'

    // Inferir horario_inicio y horario_fin si no están definidos explícitamente
    // Intenta parsear "9:00 a 18:00" → inicio="09:00", fin="18:00"
    let inicio = c.horario_inicio || '09:00'
    let fin    = c.horario_fin    || '18:00'
    if (!c.horario_inicio) {
      const match = lv.match(/(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})/)
      if (match) {
        inicio = match[1].padStart(5, '0')
        fin    = match[2].padStart(5, '0')
      }
    }

    await pool.query(`
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
    `, [
      id,
      c.nombre                     || 'Sin nombre',
      c.especialidad               || null,
      c.direccion                  || null,
      c.telefono                   || null,
      lv, sab, dom,
      duracionMin, inicio, fin,
      JSON.stringify(c.obras_sociales  || []),
      c.valor_consulta_particular  || null,
      JSON.stringify(c.formas_de_pago  || [])
    ])

    console.log(`✅ Migrado: ${id} (${c.nombre})`)
    migrados++
  }

  console.log(`\n🎉 Migración completa: ${migrados} cliente(s) migrado(s) a PostgreSQL.`)
  console.log(`   Ya podés borrar la carpeta /clientes si querés (o dejarla como backup).`)
  await pool.end()
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })