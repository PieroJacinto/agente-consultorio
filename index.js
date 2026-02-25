require('dotenv').config()
const express = require('express')
const { procesarMensaje } = require('./src/agent')

const app = express()
app.use(express.json())
app.use(express.static('public'))

const PORT = process.env.PORT || 3000

// Endpoint principal del agente
app.post('/chat', async (req, res) => {
  const { sessionId, mensaje } = req.body

  // Validamos que vengan los dos campos necesarios
  if (!sessionId || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos: sessionId y mensaje son requeridos' })
  }

  try {
    const respuesta = await procesarMensaje(sessionId, mensaje)
    res.json({ respuesta })
  } catch (error) {
    console.error('Error al procesar mensaje:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})
// Endpoint para recibir mensajes de WhatsApp via Twilio
app.post('/whatsapp', async (req, res) => {
  const mensaje = req.body.Body
  const sessionId = req.body.From // El número de WhatsApp del usuario

  try {
    const respuesta = await procesarMensaje(sessionId, mensaje)

    // Twilio espera la respuesta en formato TwiML XML
    res.set('Content-Type', 'text/xml')
    res.send(`<Response><Message>${respuesta}</Message></Response>`)
  } catch (error) {
    console.error('Error WhatsApp:', error)
    res.set('Content-Type', 'text/xml')
    res.send(`<Response><Message>Lo siento, hubo un error. Intentá de nuevo.</Message></Response>`)
  }
})
// Health check — útil para Render/Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})