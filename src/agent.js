const { chat } = require('./gemini')
const { getSesion, agregarMensaje } = require('./sessions')

async function procesarMensaje(sessionId, mensajeUsuario, clinica) {
  const historial = getSesion(sessionId)
  agregarMensaje(sessionId, 'user', mensajeUsuario)

  try {
    const respuesta = await chat(getSesion(sessionId), clinica)
    agregarMensaje(sessionId, 'model', respuesta)
    return respuesta
  } catch (error) {
    if (error.status === 429) {
      return `En este momento el asistente está temporalmente fuera de servicio. Por favor comunicarse directamente al consultorio al ${clinica.telefono}. Disculpe las molestias.`
    }
    throw error
  }
}

module.exports = { procesarMensaje }