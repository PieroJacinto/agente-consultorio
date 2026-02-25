// Guardamos las sesiones en un objeto en memoria
// En producción reemplazaríamos esto por Redis
const sesiones = {}

function getSesion(sessionId) {
  if (!sesiones[sessionId]) {
    sesiones[sessionId] = []
  }
  return sesiones[sessionId]
}

function agregarMensaje(sessionId, role, text) {
  // Gemini espera el historial en formato { role, parts: [{ text }] }
  sesiones[sessionId].push({
    role,
    parts: [{ text }]
  })
}

function limpiarSesion(sessionId) {
  delete sesiones[sessionId]
}

module.exports = { getSesion, agregarMensaje, limpiarSesion }