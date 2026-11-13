import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localRequest } from '../scripts/rehearsal-data.mjs'

test('the rehearsal refuses cloud URLs, remote hosts and unrelated ports before performing a request', async () => {
  for (const url of [
    'https://firestore.googleapis.com/v1/projects/real/databases/(default)/documents',
    'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
    'http://192.168.0.10:8180/emulator/v1/projects/real/databases/(default)/documents',
    'http://127.0.0.1:8080/some-other-service',
  ]) await assert.rejects(localRequest(url, { method: 'DELETE' }), /só pode acessar os emuladores locais/)
})
