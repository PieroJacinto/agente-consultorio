// src/dashboard.js
// Router del dashboard — se monta en index.js como: app.use('/api/dashboard', dashboardRouter)

const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getCliente } = require('./clientes')
const {
  getTurnosFiltrados,
  guardarTurnoManual,
  cancelarTurno,
  crearUsuario,
  buscarUsuarioPorEmail
} = require('./db')

const JWT_SECRET = process.env.JWT_SECRET || 'consultia-dev-secret'

// ─── MIDDLEWARE AUTH ───────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Token requerido' })
  try {
    req.usuario = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  try {
    const usuario = await buscarUsuarioPorEmail(email)
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const ok = await bcrypt.compare(password, usuario.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, clienteId: usuario.cliente_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } })
  } catch (err) {
    console.error('Error login:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── CONFIG DEL CLIENTE ───────────────────────────────────────────────────────
// Devuelve obras sociales y horarios del consultorio para armar los selects
// GET /api/dashboard/config

router.get('/config', authMiddleware, (req, res) => {
  const clinica = getCliente(req.usuario.clienteId)

  if (!clinica) {
    return res.status(404).json({ error: 'Configuración del cliente no encontrada' })
  }

  res.json({
    nombre: clinica.nombre,
    obrasSociales: [...(clinica.obras_sociales || []), 'Particular'],
    horarios: clinica.horarios_disponibles || ['08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00']
  })
})

// ─── TURNOS ───────────────────────────────────────────────────────────────────

router.get('/turnos', authMiddleware, async (req, res) => {
  try {
    const { fecha, semanaInicio, semanaFin } = req.query
    const clienteId = req.usuario.clienteId

    let turnos
    if (fecha) {
      turnos = await getTurnosFiltrados({ clienteId, fecha })
    } else if (semanaInicio && semanaFin) {
      turnos = await getTurnosFiltrados({ clienteId, semana: { inicio: semanaInicio, fin: semanaFin } })
    } else {
      turnos = await getTurnosFiltrados({ clienteId })
    }

    res.json(turnos)
  } catch (err) {
    console.error('Error al obtener turnos:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

router.post('/turnos', authMiddleware, async (req, res) => {
  const { nombre, dni, obraSocial, afiliado, motivo, fecha, horario, telefono } = req.body

  if (!nombre || !dni || !obraSocial || !fecha || !horario) {
    return res.status(400).json({ error: 'Nombre, DNI, obra social, fecha y horario son requeridos' })
  }

  try {
    const turno = await guardarTurnoManual({
      clienteId: req.usuario.clienteId,
      nombre, dni, obraSocial, afiliado, motivo, fecha, horario, telefono,
      cargadoPor: req.usuario.nombre
    })
    res.status(201).json(turno)
  } catch (err) {
    console.error('Error al crear turno:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

router.delete('/turnos/:id', authMiddleware, async (req, res) => {
  try {
    const turno = await cancelarTurno(req.params.id, req.usuario.clienteId)
    res.json({ ok: true, turno })
  } catch (err) {
    if (err.message === 'Turno no encontrado') return res.status(404).json({ error: err.message })
    console.error('Error al cancelar turno:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── USUARIOS (solo admin) ────────────────────────────────────────────────────

router.post('/usuarios', authMiddleware, async (req, res) => {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Solo admins pueden crear usuarios' })

  const { nombre, email, password, rol } = req.body
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' })

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const usuario = await crearUsuario({ clienteId: req.usuario.clienteId, nombre, email, passwordHash, rol })
    res.status(201).json(usuario)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    console.error('Error al crear usuario:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router