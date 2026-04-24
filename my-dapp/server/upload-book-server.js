import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import axios from 'axios'
import FormData from 'form-data'
import crypto from 'crypto'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

if (!process.env.PINATA_JWT) {
  throw new Error('Falta PINATA_JWT en server/.env')
}

function encryptAES(buffer, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

async function uploadFileToPinata(buffer, filename) {
  const form = new FormData()
  form.append('file', buffer, { filename })

  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    form,
    {
      maxBodyLength: Infinity,
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
    }
  )

  return `ipfs://${res.data.IpfsHash}`
}

async function uploadJsonToPinata(json) {
  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    json,
    {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
    }
  )

  return `ipfs://${res.data.IpfsHash}`
}

app.use(cors({ origin: 'http://localhost:5173' }))

app.post(
  '/api/upload-book',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const pdf = req.files?.pdf?.[0]
      const cover = req.files?.cover?.[0]

      const { bookId, title, author } = req.body

      if (!pdf) throw new Error('Falta PDF')
      if (!cover) throw new Error('Falta portada')
      if (!bookId) throw new Error('Falta bookId')

      const aesKey = crypto.randomBytes(32)
      const iv = crypto.randomBytes(16)
      const encryptedPdf = encryptAES(pdf.buffer, aesKey, iv)

      const litClient = await createLitClient({ network: nagaDev })

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
            functionParams: [':userAddress', String(bookId)],
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

      const encryptedFileUri = await uploadFileToPinata(
        encryptedPdf,
        `book_${bookId}.encrypted.bin`
      )

      const encryptedKeyUri = await uploadJsonToPinata(encryptedKey)

      const coverUri = await uploadFileToPinata(
        cover.buffer,
        cover.originalname || `cover_${bookId}.png`
      )

      const metadata = {
        name: title || `Book ${bookId}`,
        description: 'Libro protegido con AES + Lit',
        image: coverUri,
        encrypted_file: encryptedFileUri,
        encrypted_key: encryptedKeyUri,
        mime_type: 'application/pdf',
        attributes: [
          { trait_type: 'Autor', value: author || 'Unknown' },
          { trait_type: 'BookId', value: String(bookId) },
          { trait_type: 'Protección', value: 'AES + Lit' },
        ],
      }

      const metadataUri = await uploadJsonToPinata(metadata)

      res.json({
        ok: true,
        encrypted_file: encryptedFileUri,
        encrypted_key: encryptedKeyUri,
        image: coverUri,
        metadata,
        metadataURI: metadataUri,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        ok: false,
        error: err?.message || 'Error desconocido',
      })
    }
  }
)

app.listen(4000, () => {
  console.log('✅ Upload server running on http://localhost:4000')
})