const { chat } = require('./gemini')
const { getSesion, agregarMensaje } = require('./sessions')

async function procesarMensaje(sessionId, mensajeUsuario) {
  // Traemos el historial de esta sesión
  const historial = getSesion(sessionId)

  // Agregamos el mensaje del usuario al historial
  agregarMensaje(sessionId, 'user', mensajeUsuario)

  // Le mandamos el historial completo a Gemini y esperamos la respuesta
  const respuesta = await chat(getSesion(sessionId))

  // Guardamos la respuesta del modelo en el historial
  agregarMensaje(sessionId, 'model', respuesta)

  return respuesta
}

module.exports = { procesarMensaje }