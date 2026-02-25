const { GoogleGenerativeAI } = require('@google/generative-ai')
const { getSystemPrompt } = require('./prompts')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

async function chat(historial) {
  // Usamos gemini-1.5-flash: el más rápido y gratuito, ideal para chat
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: getSystemPrompt()
  })

  const chatSession = model.startChat({
    history: historial
  })

  // El último mensaje del historial es el del usuario
  const ultimoMensaje = historial[historial.length - 1].parts[0].text

  const result = await chatSession.sendMessage(ultimoMensaje)
  return result.response.text()
}

module.exports = { chat }