import fs from 'fs'
import crypto from 'crypto'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

const BOOK_ID = '8'
const CONTRACT = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'

const conditions = [
  {
    conditionType: 'evmContract',
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
      outputs: [{ type: 'bool' }]
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

  const pdf = fs.readFileSync('./book.pdf')

  // AES
  const key = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(pdf), cipher.final()])

  fs.writeFileSync('./book.encrypted.bin', encrypted)

  // payload clave
  const payload = JSON.stringify({
    key: key.toString('base64'),
    iv: iv.toString('base64')
  })

  const encryptedKey = await litClient.encrypt({
    dataToEncrypt: new TextEncoder().encode(payload),
    unifiedAccessControlConditions: conditions,
    chain: 'sepolia'
  })

  fs.writeFileSync('./key.encrypted.json', JSON.stringify(encryptedKey, null, 2))

  console.log('✅ Encrypt OK')
}

run()