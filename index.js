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

// Health check — útil para Render/Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})