require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { procesarMensaje } = require('./src/agent')
const { getCliente } = require('./src/clientes')
const { inicializarDB, getTurnosPorCliente } = require('./src/db')
const { inicializarSheet } = require('./src/sheets')
const dashboardRouter = require('./src/dashboard')

const app = express()

app.use(cors({
  origin: [
    'https://consultia-landing.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ]
}))

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))

inicializarDB().catch(console.error)
inicializarSheet().catch(console.error)

const PORT = process.env.PORT || 3000

// Endpoint web — siempre usa el cliente "demo"
app.post('/chat', async (req, res) => {
  const { sessionId, mensaje } = req.body
  if (!sessionId || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos: sessionId y mensaje son requeridos' })
  }

  // getCliente ahora es async
  const clinica = await getCliente('demo')
  if (!clinica) {
    return res.status(500).json({ error: 'Configuración del cliente no encontrada' })
  }

  try {
    const respuesta = await procesarMensaje(sessionId, mensaje, clinica)
    res.json({ respuesta })
  } catch (error) {
    console.error('Error al procesar mensaje:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Endpoint WhatsApp — identifica el cliente por el número destino
app.post('/whatsapp', async (req, res) => {
  const mensaje      = req.body.Body
  const sessionId    = req.body.From
  const destinatario = req.body.To

  console.log(`📱 Mensaje de ${sessionId} para ${destinatario}: ${mensaje}`)

  // getCliente ahora es async
  const clinica = await getCliente(destinatario)
  if (!clinica) {
    res.set('Content-Type', 'text/xml')
    return res.send(`<Response><Message>Lo siento, este número no está configurado.</Message></Response>`)
  }

  try {
    const respuesta = await procesarMensaje(sessionId, mensaje, clinica)
    res.set('Content-Type', 'text/xml')
    res.send(`<Response><Message>${respuesta}</Message></Response>`)
  } catch (error) {
    console.error('Error WhatsApp:', error)
    res.set('Content-Type', 'text/xml')
    res.send(`<Response><Message>Lo siento, hubo un error. Intentá de nuevo.</Message></Response>`)
  }
})

// Dashboard
app.use('/api/dashboard', dashboardRouter)
app.get('/dashboard', (req, res) => {
  res.sendFile('dashboard.html', { root: 'public' })
})

// Ver turnos de un cliente (testing)
app.get('/turnos/:clienteId', async (req, res) => {
  const turnos = await getTurnosPorCliente(req.params.clienteId)
  res.json({ total: turnos.length, turnos })
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`)
})