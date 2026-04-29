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

const [, , bookIdArg, encryptedKeyPath, encryptedPdfPath] = process.argv

if (!bookIdArg || !encryptedKeyPath || !encryptedPdfPath) {
  console.error(
    'Uso: node decrypt.js <bookId> <key.encrypted.json> <book.encrypted.bin>'
  )
  console.error(
    'Ejemplo: node decrypt.js 14 ./key.encrypted.json ./book.encrypted.bin'
  )
  process.exit(1)
}

const BOOK_ID = bookIdArg
const CONTRACT = '0x0Cf7cA5a8d2557A9cA255997FD0722A97a482c80'

const evmContractConditions = [
  {
    contractAddress: CONTRACT,
    //chain: 'sepolia',
    chain: 'polygon',
    functionName: 'hasUserBook',
    functionParams: [':userAddress', BOOK_ID],
    functionAbi: {
      name: 'hasUserBook',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'user', type: 'address' },
        { name: 'bookId', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    returnValueTest: {
      key: '',
      comparator: '=',
      value: 'true',
    },
  },
]

async function run() {
  console.log('🌐 Lit connect...')
  const litClient = await createLitClient({ network: nagaDev })

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'lit-simple',
      networkName: 'naga-dev',
      storagePath: './.lit-cache',
    }),
  })

  const account = privateKeyToAccount(PRIVATE_KEY)

  const authContext = await authManager.createEoaAuthContext({
    config: { account },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt book',
      expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      resources: [['access-control-condition-decryption', '*']],
    },
    litClient,
  })

  console.log('📥 Leyendo key JSON...')
  const keyJson = JSON.parse(fs.readFileSync(encryptedKeyPath, 'utf-8'))

  console.log('🔓 Descifrando clave con Lit...')
  const decrypted = await litClient.decrypt({
    data: keyJson,
    evmContractConditions,
    chain: 'sepolia',
    authContext,
  })

  console.log('Lit decrypted result:', decrypted)

  let decryptedText = ''

  if (decrypted instanceof Uint8Array) {
    decryptedText = new TextDecoder().decode(decrypted)
  } else if (decrypted?.decryptedData instanceof Uint8Array) {
    decryptedText = new TextDecoder().decode(decrypted.decryptedData)
  } else if (typeof decrypted === 'string') {
    decryptedText = decrypted
  } else if (typeof decrypted?.decryptedData === 'string') {
    decryptedText = decrypted.decryptedData
  }

  console.log('Texto descifrado por Lit:', decryptedText)

  if (!decryptedText || decryptedText === 'undefined') {
    throw new Error(
      `Lit devolvió una clave inválida. Revisa que PRIVATE_KEY haya comprado el bookId ${BOOK_ID}.`
    )
  }

  let decoded

  try {
    decoded = JSON.parse(decryptedText)
  } catch {
    throw new Error(`Lit devolvió texto no JSON: ${decryptedText}`)
  }

  if (!decoded.key || !decoded.iv) {
    throw new Error('La clave descifrada no contiene key o iv')
  }

  console.log('📥 Leyendo PDF cifrado...')
  const encryptedPdf = fs.readFileSync(encryptedPdfPath)

  console.log('📖 Descifrando PDF...')
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(decoded.key, 'base64'),
    Buffer.from(decoded.iv, 'base64')
  )

  const pdf = Buffer.concat([decipher.update(encryptedPdf), decipher.final()])

  fs.writeFileSync('./book.decrypted.pdf', pdf)

  console.log('✅ Decrypt OK')
  console.log('Archivo creado: ./book.decrypted.pdf')
}

run().catch((err) => {
  console.error('❌ Error en decrypt.js:', err)
})