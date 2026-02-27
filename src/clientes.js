const fs = require('fs')
const path = require('path')

// Convierte el número de WhatsApp en un nombre de carpeta válido
// "whatsapp:+14155238886" → "whatsapp_+14155238886"
function normalizarId(rawId) {
  return rawId.replace(':', '_')
}

function getCliente(clienteId) {
  const idNormalizado = normalizarId(clienteId)
  const rutaJson = path.join(__dirname, '..', 'clientes', idNormalizado, 'clinica.json')

  if (!fs.existsSync(rutaJson)) {
    console.warn(`⚠️  Cliente no encontrado: ${idNormalizado}`)
    return null
  }

  const datos = fs.readFileSync(rutaJson, 'utf-8')
  return JSON.parse(datos)
}

module.exports = { getCliente }