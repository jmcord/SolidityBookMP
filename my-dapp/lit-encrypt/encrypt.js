import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAccBuilder } from '@lit-protocol/access-control-conditions'

const run = async () => {
  const litClient = await createLitClient({
    network: nagaDev,
  })

  const file = fs.readFileSync('./book.pdf')

  const builder = createAccBuilder()

  const accs = builder
    .requireWalletOwnership('TU_WALLET_AQUI')
    .on('ethereum')
    .build()

  const encryptedData = await litClient.encrypt({
    dataToEncrypt: new Uint8Array(file),
    unifiedAccessControlConditions: accs,
    chain: 'ethereum',
  })

  fs.writeFileSync(
    './book.encrypted.json',
    JSON.stringify(encryptedData, null, 2),
    'utf-8'
  )

  console.log('✅ PDF cifrado y guardado como JSON')
}

run().catch(console.error)