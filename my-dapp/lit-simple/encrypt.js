import fs from 'fs'
import crypto from 'crypto'
import axios from 'axios'
import FormData from 'form-data'
import dotenv from 'dotenv'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

dotenv.config()

const [, , filePath, bookIdArg, title, author, coverPath] = process.argv

if (!filePath || !bookIdArg) {
  console.error('Uso: node encrypt.js <pdf> <bookId> "title" "author" [coverPath]')
  console.error('Ejemplo: node encrypt.js ./book.pdf 16 "Libro Final" "chema" ./cover.png')
  process.exit(1)
}

if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
  console.error('Faltan PINATA_API_KEY o PINATA_SECRET_API_KEY en .env')
  process.exit(1)
}

const BOOK_ID = Number(bookIdArg)

if (!Number.isInteger(BOOK_ID) || BOOK_ID <= 0) {
  console.error('bookId debe ser un número entero positivo')
  process.exit(1)
}

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

const evmContractConditions = [
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
]

function encryptAES(buffer, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

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

async function uploadJSON(json, name = 'metadata.json') {
  const body = {
    pinataMetadata: {
      name,
    },
    pinataContent: json,
  }

  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    body,
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

  const keyPayload = JSON.stringify({
    key: aesKey.toString('base64'),
    iv: iv.toString('base64'),
  })

  console.log('KEY PAYLOAD ANTES DE CIFRAR:', keyPayload)

  console.log('🌐 Lit connect...')
  const litClient = await createLitClient({ network: nagaDev })

  console.log('🔐 Cifrando clave AES con Lit...')

  const encryptedKeyResult = await litClient.encrypt({
    dataToEncrypt: new TextEncoder().encode(keyPayload),
    evmContractConditions,
  })

  console.log('encryptedKeyResult:', encryptedKeyResult)

  const encryptedKeyJson = {
    ...encryptedKeyResult,
    evmContractConditions,
    chain: 'sepolia',
  }

  console.log('🌐 Subiendo encrypted.bin...')
  const encryptedFileUri = await uploadFile(
    encryptedFile,
    `book_${BOOK_ID}.encrypted.bin`
  )

  console.log('🌐 Subiendo key.json...')
  const encryptedKeyUri = await uploadJSON(
    encryptedKeyJson,
    `book_${BOOK_ID}.key.json`
  )

  let coverUri = ''

  if (coverPath) {
    console.log('🌐 Subiendo portada...')
    const coverBuffer = fs.readFileSync(coverPath)
    const coverName = coverPath.split(/[\\/]/).pop() || `cover_${BOOK_ID}.png`
    coverUri = await uploadFile(coverBuffer, coverName)
  }

  console.log('📜 Creando metadata...')

  const metadata = {
    name: title || `Book ${BOOK_ID}`,
    description: 'Libro protegido con AES + Lit',
    image: coverUri || '',
    encrypted_file: encryptedFileUri,
    encrypted_key: encryptedKeyUri,
    mime_type: 'application/pdf',
    attributes: [
      { trait_type: 'Autor', value: author || 'Unknown' },
      { trait_type: 'BookId', value: BOOK_ID.toString() },
      { trait_type: 'Protección', value: 'AES + Lit' },
    ],
  }

  console.log('🌐 Subiendo metadata...')
  const metadataUri = await uploadJSON(metadata, `book_${BOOK_ID}.metadata.json`)

  console.log('\n✅ DONE\n')
  console.log('encrypted_file:', encryptedFileUri)
  console.log('encrypted_key :', encryptedKeyUri)
  console.log('cover         :', coverUri || '(sin portada)')
  console.log('metadata      :', metadataUri)
  console.log('\nPega este Metadata URI al crear el libro:')
  console.log(metadataUri)
}

run().catch((err) => {
  console.error('❌ Error:', err?.response?.data || err)
})