import 'dotenv/config'
import fs from 'fs'
import crypto from 'crypto'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PRIVATE_KEY) {
  throw new Error('Falta PRIVATE_KEY en .env')
}

const BOOK_ID = '8'
const CONTRACT = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

const evmContractConditions = [
  {
    contractAddress: CONTRACT,
    chain: 'sepolia',
    functionName: 'hasUserBook',
    functionParams: [':userAddress', BOOK_ID],
    functionAbi: {
      name: 'hasUserBook',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'user', type: 'address' },
        { name: 'bookId', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }]
    },
    returnValueTest: {
      key: '',
      comparator: '=',
      value: 'true'
    }
  }
]

async function run() {
  const litClient = await createLitClient({ network: nagaDev })

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'lit-simple',
      networkName: 'naga-dev',
      storagePath: './.lit-cache'
    })
  })

  const account = privateKeyToAccount(PRIVATE_KEY)

  const authContext = await authManager.createEoaAuthContext({
    config: { account },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt book',
      expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      resources: [['access-control-condition-decryption', '*']]
    },
    litClient
  })

  const keyJson = JSON.parse(fs.readFileSync('./key.encrypted.json', 'utf-8'))

  const decrypted = await litClient.decrypt({
  data: keyJson,
  evmContractConditions,
  chain: 'sepolia',
  authContext
})

  const keyBytes =
    decrypted instanceof Uint8Array
      ? decrypted
      : decrypted?.decryptedData instanceof Uint8Array
      ? decrypted.decryptedData
      : new Uint8Array(decrypted)

  const decoded = JSON.parse(new TextDecoder().decode(keyBytes))

  const encryptedPdf = fs.readFileSync('./book.encrypted.bin')

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(decoded.key, 'base64'),
    Buffer.from(decoded.iv, 'base64')
  )

  const pdf = Buffer.concat([decipher.update(encryptedPdf), decipher.final()])

  fs.writeFileSync('./book.decrypted.pdf', pdf)

  console.log('✅ Decrypt OK')
}

run().catch((err) => {
  console.error('❌ Error en decrypt.js:', err)
})