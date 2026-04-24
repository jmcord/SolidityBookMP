import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

const [, , filePath, bookIdArg] = process.argv

if (!filePath || !bookIdArg) {
  console.error('Uso: node encrypt.js <pdf_path> <bookId>')
  process.exit(1)
}

const BOOK_ID = Number(bookIdArg)

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

// 🔐 AES helpers
function encryptAES(buffer, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

async function run() {
  console.log('📥 Leyendo PDF...')
  const fileBuffer = fs.readFileSync(filePath)

  console.log('🔑 Generando clave AES...')
  const aesKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)

  console.log('🔒 Cifrando PDF...')
  const encryptedFile = encryptAES(fileBuffer, aesKey, iv)

  console.log('🌐 Conectando a Lit...')
  const litClient = await createLitClient({
    network: nagaDev,
  })

  console.log('🔐 Cifrando clave con Lit...')

  const keyPayload = JSON.stringify({
    key: aesKey.toString('base64'),
    iv: iv.toString('base64'),
  })

  const encryptedKey = await litClient.encrypt({
    data: new TextEncoder().encode(keyPayload),
    evmContractConditions: [
      {
        contractAddress: MARKETPLACE_ADDRESS,
        chain: 'sepolia',
        functionName: 'hasUserBook',
        functionParams: [':userAddress', BOOK_ID.toString()],
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
    ],
  })

  // 📁 guardar sin pisar
  const timestamp = Date.now()
  const outDir = `./outputs/book_${BOOK_ID}_${timestamp}`

  fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(`${outDir}/encrypted.bin`, encryptedFile)
  fs.writeFileSync(`${outDir}/key.json`, JSON.stringify(encryptedKey, null, 2))

  console.log('✅ LISTO')
  console.log('📁 Carpeta:', outDir)
}

run().catch(console.error)