import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'

const MARKETPLACE_ADDRESS = '0x2b31812EbcDa863dE6635A1Ad83F581212ED3b18'
const BOOK_ID = '5' // cambia esto según el libro

async function run() {
  const litClient = await createLitClient({
    network: nagaDev,
  })

  const file = fs.readFileSync('./book.pdf')

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

  const encryptedData = await litClient.encrypt({
    dataToEncrypt: new Uint8Array(file),
    unifiedAccessControlConditions,
    chain: 'sepolia',
  })

  fs.writeFileSync(
    './book.encrypted.json',
    JSON.stringify(encryptedData, null, 2),
    'utf-8'
  )

  console.log('✅ PDF cifrado con condición hasUserBook(user, bookId) == true')
}

run().catch(console.error)