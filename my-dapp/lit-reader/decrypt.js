import 'dotenv/config'
import fs from 'fs'
import crypto from 'crypto'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('Falta PRIVATE_KEY en .env')

const INPUT_FILE = './book.encrypted.json'
const OUTPUT_FILE = './book.decrypted.pdf'

async function run() {
  const litClient = await createLitClient({ network: nagaDev })

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'lit-reader',
      networkName: 'naga-dev',
      storagePath: './.lit-cache',
    }),
  })

  const account = privateKeyToAccount(PRIVATE_KEY)

  const authContext = await authManager.createEoaAuthContext({
    config: { account },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt AES key for purchased book',
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      resources: [
        ['access-control-condition-decryption', '*'],
        ['lit-action-execution', '*'],
      ],
    },
    litClient,
  })

  // Leer JSON cifrado
  const encryptedJson = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))

  // 1) Lit descifra SOLO la clave AES (no el PDF)
  const decryptedKeyResult = await litClient.decrypt({
    data: {
      encryptedSymmetricKey: encryptedJson.encryptedSymmetricKey,
      dataToEncryptHash: encryptedJson.dataToEncryptHash,
    },
    unifiedAccessControlConditions:
      encryptedJson.unifiedAccessControlConditions,
    chain: encryptedJson.chain,
    authContext,
  })

  const keyBytes =
    decryptedKeyResult instanceof Uint8Array
      ? decryptedKeyResult
      : decryptedKeyResult?.decryptedData instanceof Uint8Array
      ? decryptedKeyResult.decryptedData
      : new Uint8Array(decryptedKeyResult)

  const keyPayload = JSON.parse(new TextDecoder().decode(keyBytes))

  const aesKey = Buffer.from(keyPayload.key, 'base64')
  const iv = Buffer.from(keyPayload.iv, 'base64')

  // 2) Node descifra el PDF localmente
  const encryptedPdf = Buffer.from(encryptedJson.ciphertext, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv)
  const decryptedPdf = Buffer.concat([
    decipher.update(encryptedPdf),
    decipher.final(),
  ])

  fs.writeFileSync(OUTPUT_FILE, decryptedPdf)

  console.log('✅ Clave AES recuperada con Lit')
  console.log('✅ PDF reconstruido en', OUTPUT_FILE)
}

run().catch(console.error)
