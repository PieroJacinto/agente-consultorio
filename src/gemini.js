const { GoogleGenerativeAI } = require('@google/generative-ai')
const { getSystemPrompt } = require('./prompts')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

async function chat(historial, clinica) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: getSystemPrompt(clinica)
  })

  const chatSession = model.startChat({
    history: historial
  })

  const ultimoMensaje = historial[historial.length - 1].parts[0].text
  const result = await chatSession.sendMessage(ultimoMensaje)
  return result.response.text()
}

module.exports = { chat }