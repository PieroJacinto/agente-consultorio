const { google } = require('googleapis')
const path = require('path')

const SPREADSHEET_ID = '1Cy9S3KBZ96QIRgmyVJqsV3fguxKETGBJjF2gM-JI3bI'
const SHEET_NAME = 'Hoja 1'

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'google-credentials.json'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  })
  return auth.getClient()
}

async function inicializarSheet() {
  try {
    const authClient = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth: authClient })

    // Verificamos si ya tiene encabezados
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H1`
    })

    const filas = response.data.values
    if (!filas || filas.length === 0) {
      // Agregamos encabezados
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['ID', 'Consultorio', 'Paciente', 'Teléfono', 'Obra Social', 'Horario', 'Estado', 'Fecha registro']]
        }
      })
      console.log('✅ Google Sheets inicializado con encabezados')
    }
  } catch (error) {
    console.error('Error al inicializar Google Sheets:', error.message)
  }
}

async function agregarTurnoSheet(turno) {
  try {
    const authClient = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth: authClient })

    const fecha = new Date(turno.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          turno.id,
          turno.cliente_id,
          turno.paciente_nombre,
          turno.paciente_telefono,
          turno.obra_social,
          turno.horario,
          turno.estado,
          fecha
        ]]
      }
    })

    console.log(`📊 Turno agregado a Google Sheets: ${turno.paciente_nombre}`)
  } catch (error) {
    console.error('Error al agregar turno a Sheets:', error.message)
  }
}

module.exports = { inicializarSheet, agregarTurnoSheet }