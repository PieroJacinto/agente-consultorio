const { chat } = require('./gemini')
const { getSesion, agregarMensaje } = require('./sessions')
const { guardarTurno } = require('./db')

async function procesarMensaje(sessionId, mensajeUsuario, clinica) {
  const historial = getSesion(sessionId)
  agregarMensaje(sessionId, 'user', mensajeUsuario)

  try {
    const respuestaRaw = await chat(getSesion(sessionId), clinica)

    const tieneTurno = respuestaRaw.includes('%%TURNO%%')
    let respuestaLimpia = respuestaRaw

    if (tieneTurno) {
      try {
        const partes = respuestaRaw.split('%%TURNO%%')
        const jsonTurno = partes[1].trim()
        const datosTurno = JSON.parse(jsonTurno)

        await guardarTurno({
          clienteId: clinica.id,
          nombre: datosTurno.nombre,
          telefono: sessionId,
          obraSocial: datosTurno.obraSocial,
          fecha: null,
          horario: datosTurno.horario
        })

        console.log(`📅 Turno guardado para ${datosTurno.nombre} en ${clinica.nombre}`)
        respuestaLimpia = partes[0].trim()

      } catch (errorTurno) {
        if (errorTurno.message.startsWith('HORARIO_OCUPADO:')) {
          const horarioOcupado = errorTurno.message.split(':')[1]
          console.warn(`⚠️  Horario ocupado: ${horarioOcupado}`)

          // Le avisamos al agente que el horario está ocupado para que ofrezca otro
          const mensajeError = `El sistema indica que el horario ${horarioOcupado} ya está ocupado. Informale al paciente y ofrecele los otros horarios disponibles.`
          agregarMensaje(sessionId, 'user', mensajeError)
          const respuestaAlternativa = await chat(getSesion(sessionId), clinica)
          respuestaLimpia = respuestaAlternativa.split('%%TURNO%%')[0].trim()

        } else {
          console.error('Error al guardar turno:', errorTurno)
          respuestaLimpia = partes[0].trim()
        }
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