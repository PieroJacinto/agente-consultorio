const { chat } = require('./gemini')
const { getSesion, agregarMensaje } = require('./sessions')

async function procesarMensaje(sessionId, mensajeUsuario) {
  const historial = getSesion(sessionId)
  agregarMensaje(sessionId, 'user', mensajeUsuario)

  try {
    const respuesta = await chat(getSesion(sessionId))
    agregarMensaje(sessionId, 'model', respuesta)
    return respuesta
  } catch (error) {
    // Si se agotó la cuota de la API
    if (error.status === 429) {
      return 'En este momento el asistente está temporalmente fuera de servicio. Por favor comunicarse directamente al consultorio al +54 11 4567-8900. Disculpe las molestias.'
    }
    // Cualquier otro error
    throw error
  }
}

module.exports = { procesarMensaje }