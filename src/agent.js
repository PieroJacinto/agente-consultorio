const { chat } = require('./gemini')
const { getSesion, agregarMensaje } = require('./sessions')
const { guardarTurno } = require('./db')

async function procesarMensaje(sessionId, mensajeUsuario, clinica) {
  const historial = getSesion(sessionId)
  agregarMensaje(sessionId, 'user', mensajeUsuario)

  try {
    const respuestaRaw = await chat(getSesion(sessionId), clinica)

    // Detectamos si hay un bloque de turno en la respuesta
    const tieneTurno = respuestaRaw.includes('%%TURNO%%')
    let respuestaLimpia = respuestaRaw

    if (tieneTurno) {
      try {
        // Extraemos el JSON entre los delimitadores
        const partes = respuestaRaw.split('%%TURNO%%')
        const jsonTurno = partes[1].trim()
        const datosTurno = JSON.parse(jsonTurno)

        // Guardamos el turno en la base de datos
        await guardarTurno({
          clienteId: clinica.id,
          nombre: datosTurno.nombre,
          telefono: sessionId, // el sessionId en WhatsApp es el número del paciente
          obraSocial: datosTurno.obraSocial,
          fecha: null,
          horario: datosTurno.horario
        })

        console.log(`📅 Turno guardado para ${datosTurno.nombre} en ${clinica.nombre}`)

        // Limpiamos el bloque JSON de la respuesta que ve el paciente
        respuestaLimpia = partes[0].trim()
      } catch (errorTurno) {
        console.error('Error al guardar turno:', errorTurno)
        // Si falla el guardado, igual respondemos normalmente
        respuestaLimpia = respuestaRaw.split('%%TURNO%%')[0].trim()
      }
    }

    agregarMensaje(sessionId, 'model', respuestaLimpia)
    return respuestaLimpia

  } catch (error) {
    if (error.status === 429) {
      return `En este momento el asistente está temporalmente fuera de servicio. Por favor comunicarse directamente al consultorio al ${clinica.telefono}. Disculpe las molestias.`
    }
    throw error
  }
}

module.exports = { procesarMensaje }