import 'dotenv/config'
import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'
import { decryptToUint8Array } from '@lit-protocol/encryption'

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

  // 1. Crear authSig (firma SIWE)
  const authSig = await authManager.createEoaAuthSig({
    account,
    statement: 'Decrypt book',
    expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    litClient,
  })

  const raw = fs.readFileSync(ENCRYPTED_FILE, 'utf-8')
  const parsedJsonData = JSON.parse(raw)

  console.log('🔓 Descifrando con decryptToUint8Array...')

  // 2. Descifrar usando authSig
  const decryptedBytes = await decryptToUint8Array(
    {
      accessControlConditions: parsedJsonData.accessControlConditions,
      evmContractConditions: parsedJsonData.evmContractConditions,
      solRpcConditions: parsedJsonData.solRpcConditions,
      unifiedAccessControlConditions:
        parsedJsonData.unifiedAccessControlConditions,
      ciphertext: parsedJsonData.ciphertext,
      dataToEncryptHash: parsedJsonData.dataToEncryptHash,
      chain: parsedJsonData.chain || 'sepolia',
      authSig,
    },
    litClient
  )

  fs.writeFileSync('./book.decrypted.pdf', Buffer.from(decryptedBytes))
  console.log('✅ PDF descifrado en book.decrypted.pdf')
}

run().catch((err) => {
  console.error('❌ Error al descifrar:', err)
})
