import { httpsCallable } from 'firebase/functions'
import { cloudFunctions } from './firebase.js'

async function callServer(name, data = {}) {
  if (!cloudFunctions) throw new Error('Configure o Firebase para usar a apuração automática.')
  try { return (await httpsCallable(cloudFunctions, name, { timeout: 120000 })(data)).data }
  catch (error) {
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') throw new Error('A apuração no servidor ainda não está disponível. Publique as funções do Firebase junto desta versão.', { cause: error })
    throw error
  }
}
export const requestServerRecalculation = () => callServer('recalculateRanking')
export const requestFinalReport = (filters) => callServer('prepareFinalReport', filters)
