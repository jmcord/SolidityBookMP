import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { encryptToJson } from '@lit-protocol/encryption'

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'
const BOOK_ID = '8'
const INPUT_FILE = './book.pdf'
const OUTPUT_FILE = './book.encrypted.json'

const unifiedAccessControlConditions = [
  {
    conditionType: 'evmContract',
    contractAddress: MARKETPLACE_ADDRESS,
    chain: 'sepolia',
    functionName: 'hasUserBook',
    functionParams: [':userAddress', BOOK_ID],
    functionAbi: {
      name: 'hasUserBook',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        {
          name: 'user',
          type: 'address',
          internalType: 'address',
        },
        {
          name: 'bookId',
          type: 'uint256',
          internalType: 'uint256',
        },
      ],
      outputs: [
        {
          name: '',
          type: 'bool',
          internalType: 'bool',
        },
      ],
    },
    returnValueTest: {
      key: '',
      comparator: '=',
      value: 'true',
    },
  },
]

async function run() {
  const litClient = await createLitClient({
    network: nagaDev,
  })

  const fileBuffer = fs.readFileSync(INPUT_FILE)
  const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' })

  console.log('📘 Tamaño de book.pdf:')
  console.log(`   ${fileBuffer.length} bytes`)
  console.log(`   ${(fileBuffer.length / 1024).toFixed(2)} KB`)
  console.log(`   ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  console.log('🔐 Cifrando con encryptToJson...')

  const encryptedJsonString = await encryptToJson({
    file: fileBlob,
    unifiedAccessControlConditions,
    chain: 'sepolia',
    litNodeClient: litClient,
  })

  const outBytes = Buffer.byteLength(encryptedJsonString, 'utf8')

  console.log('📦 Tamaño de book.encrypted.json:')
  console.log(`   ${outBytes} bytes`)
  console.log(`   ${(outBytes / 1024).toFixed(2)} KB`)
  console.log(`   ${(outBytes / 1024 / 1024).toFixed(2)} MB`)

  fs.writeFileSync(OUTPUT_FILE, encryptedJsonString, 'utf-8')

  console.log(`✅ Archivo cifrado guardado en ${OUTPUT_FILE}`)
}

run().catch((err) => {
  console.error('❌ Error al cifrar:', err)
})