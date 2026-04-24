import fs from 'fs'
import crypto from 'crypto'
import axios from 'axios'
import FormData from 'form-data'
import dotenv from 'dotenv'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

dotenv.config()

const [, , filePath, bookIdArg, title, author] = process.argv

if (!filePath || !bookIdArg) {
  console.error('Uso: node encrypt-upload.js <pdf> <bookId> "title" "author"')
  process.exit(1)
}

const BOOK_ID = Number(bookIdArg)

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

function encryptAES(buffer, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

// 📤 subir a Pinata
async function uploadFile(buffer, name) {
  const form = new FormData()
  form.append('file', buffer, { filename: name })

  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    form,
    {
      maxBodyLength: Infinity,
      headers: {
        ...form.getHeaders(),
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
      },
    }
  )

  return `ipfs://${res.data.IpfsHash}`
}

async function uploadJSON(json) {
  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    json,
    {
      headers: {
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
      },
    }
  )

  return `ipfs://${res.data.IpfsHash}`
}

async function run() {
  console.log('📥 Leyendo PDF...')
  const fileBuffer = fs.readFileSync(filePath)

  console.log('🔑 Generando AES...')
  const aesKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)

  console.log('🔒 Cifrando PDF...')
  const encryptedFile = encryptAES(fileBuffer, aesKey, iv)

  console.log('🌐 Lit connect...')
  const litClient = await createLitClient({ network: nagaDev })

  const keyPayload = JSON.stringify({
    key: aesKey.toString('base64'),
    iv: iv.toString('base64'),
  })

  console.log('🔐 Cifrando clave con Lit...')
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

  console.log('🌐 Subiendo encrypted.bin...')
  const fileCid = await uploadFile(encryptedFile, 'book.bin')

  console.log('🌐 Subiendo key.json...')
  const keyCid = await uploadJSON(encryptedKey)

  console.log('📜 Creando metadata...')

  const metadata = {
    name: title || `Book ${BOOK_ID}`,
    description: `Libro cifrado con Lit`,
    encrypted_file: fileCid,
    encrypted_key: keyCid,
    mime_type: 'application/pdf',
    attributes: [
      { trait_type: 'Autor', value: author || 'Unknown' },
      { trait_type: 'BookId', value: BOOK_ID.toString() },
    ],
  }

  console.log('🌐 Subiendo metadata...')
  const metadataCid = await uploadJSON(metadata)

  console.log('\n✅ DONE\n')
  console.log('encrypted_file:', fileCid)
  console.log('encrypted_key :', keyCid)
  console.log('metadata      :', metadataCid)
}

run().catch(console.error)