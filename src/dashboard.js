// src/dashboard.js
const express    = require('express')
const router     = express.Router()
const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
const { getClienteDB, getTurnosFiltrados, guardarTurnoManual,
        cancelarTurno, crearUsuario, buscarUsuarioPorEmail } = require('./db')

const JWT_SECRET = process.env.JWT_SECRET || 'consultia-dev-secret'

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
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

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  try {
    const usuario = await buscarUsuarioPorEmail(email)
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const ok = await bcrypt.compare(password, usuario.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre,
        rol: usuario.rol, clienteId: usuario.cliente_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    )
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } })
  } catch (err) {
    console.error('Error login:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ── CONFIG DEL CLIENTE (desde DB) ─────────────────────────────────────────────
// Genera los slots automáticamente según duración y rango horario del cliente
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const clinica = await getClienteDB(req.usuario.clienteId)
    if (!clinica) return res.status(404).json({ error: 'Cliente no encontrado' })

    const horarios = generarSlots(
      clinica.horario_inicio        || '09:00',
      clinica.horario_fin           || '18:00',
      clinica.duracion_turno_minutos || 30
    )

    res.json({
      nombre:            clinica.nombre,
      especialidad:      clinica.especialidad,
      direccion:         clinica.direccion,
      telefono:          clinica.telefono,
      duracionMinutos:   clinica.duracion_turno_minutos || 30,
      horarioAtencion:   clinica.horarios || {},
      obrasSociales:     [...(clinica.obras_sociales || []), 'Particular'],
      horarios,
      formasDePago:      clinica.formas_de_pago || [],
      valorParticular:   clinica.valor_consulta_particular || ''
    })
  } catch (err) {
    console.error('Error config:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// Genera ["09:00","09:30","10:00"...] desde inicio hasta fin cada duracionMin minutos
function generarSlots(inicio, fin, duracionMin) {
  const slots = []
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fin.split(':').map(Number)
  let total = hI * 60 + mI
  const finMin = hF * 60 + mF
  while (total < finMin) {
    slots.push(`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`)
    total += duracionMin
  }
  return slots
}

// ── TURNOS ────────────────────────────────────────────────────────────────────
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
    console.error('Error turnos:', err)
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
    console.error('Error crear turno:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

router.delete('/turnos/:id', authMiddleware, async (req, res) => {
  try {
    const turno = await cancelarTurno(req.params.id, req.usuario.clienteId)
    res.json({ ok: true, turno })
  } catch (err) {
    if (err.message === 'Turno no encontrado') return res.status(404).json({ error: err.message })
    console.error('Error cancelar:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ── USUARIOS (solo admin) ─────────────────────────────────────────────────────
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
    console.error('Error crear usuario:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router