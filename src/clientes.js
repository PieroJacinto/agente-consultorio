// src/clientes.js
// Ahora lee de PostgreSQL en vez de archivos JSON
// La firma de getCliente es la misma — el resto del código no cambia

const { getClienteDB } = require('./db')

// Convierte "whatsapp:+14155238886" → "whatsapp_+14155238886"
function normalizarId(rawId) {
  return rawId.replace(':', '_')
}

// Versión async — busca en la DB
async function getCliente(clienteId) {
  const idNormalizado = normalizarId(clienteId)
  const cliente = await getClienteDB(idNormalizado)
  if (!cliente) {
    console.warn(`⚠️  Cliente no encontrado en DB: ${idNormalizado}`)
    return null
  }
  return cliente
}

module.exports = { getCliente }