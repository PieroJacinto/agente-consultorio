require('dotenv').config()
const express = require('express')
const { procesarMensaje } = require('./src/agent')
const { getCliente } = require('./src/clientes')
const { inicializarDB } = require('./src/db')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))

inicializarDB().catch(console.error)

const PORT = process.env.PORT || 3000

// Endpoint web — siempre usa el cliente "demo"
app.post('/chat', async (req, res) => {
  const { sessionId, mensaje } = req.body

  if (!sessionId || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos: sessionId y mensaje son requeridos' })
  }

  const clinica = getCliente('demo')
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

// Endpoint WhatsApp — identifica el cliente por el número destino (req.body.To)
app.post('/whatsapp', async (req, res) => {
  const mensaje = req.body.Body
  const sessionId = req.body.From  // número del paciente (quién escribe)
  const destinatario = req.body.To  // número del consultorio (a quién le escriben)

  console.log(`📱 Mensaje de ${sessionId} para ${destinatario}: ${mensaje}`)

  const clinica = getCliente(destinatario)

  if (!clinica) {
    res.set('Content-Type', 'text/xml')
    return res.send(`<Response><Message>Lo siento, este número no está configurado. Por favor contacte al administrador.</Message></Response>`)
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
