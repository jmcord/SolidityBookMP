import 'dotenv/config'
import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PRIVATE_KEY) {
  throw new Error('Falta PRIVATE_KEY en .env')
}

const ENCRYPTED_FILE = './book.encrypted.json'

async function run() {
  const litClient = await createLitClient({
    network: nagaDev,
  })

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'lit-reader',
      networkName: 'naga-dev',
      storagePath: './.lit-cache',
    }),
  })

  const account = privateKeyToAccount(PRIVATE_KEY)

  const authContext = await authManager.createEoaAuthContext({
    config: {
      account,
    },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt book',
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      resources: [
        ['access-control-condition-decryption', '*'],
        ['lit-action-execution', '*'],
      ],
    },
    litClient,
  })

  const encryptedJson = JSON.parse(
    fs.readFileSync(ENCRYPTED_FILE, 'utf-8')
  )

  const decrypted = await litClient.decrypt({
    data: encryptedJson,
    authContext,
    chain: 'ethereum',
  })

  const pdfBytes =
    decrypted instanceof Uint8Array
      ? decrypted
      : decrypted?.decryptedData instanceof Uint8Array
      ? decrypted.decryptedData
      : new Uint8Array(decrypted)

  fs.writeFileSync('./book.decrypted.pdf', pdfBytes)

  console.log('✅ PDF descifrado en book.decrypted.pdf')
}

run().catch((err) => {
  console.error('❌ Error al descifrar:', err)
})