import fs from 'fs'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager } from '@lit-protocol/auth'
import { privateKeyToAccount } from 'viem/accounts'

// 1. Pon aquí la private key de la wallet que SÍ puede descifrar.
// Debe ser la misma wallet autorizada en tu cifrado de prueba.
// Mejor leerla desde variable de entorno luego.
const PRIVATE_KEY = '0xTU_PRIVATE_KEY_AQUI'

// 2. Archivo cifrado descargado desde Pinata/IPFS
const ENCRYPTED_FILE = './book.encrypted.json'

async function run() {
  const litClient = await createLitClient({
    network: nagaDev,
  })

  const authManager = createAuthManager()

  const account = privateKeyToAccount(PRIVATE_KEY)

  const authContext = await authManager.createEoaAuthContext({
    config: {
      account,
    },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt book',
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      resources: [
        ['access-control-condition-decryption', '*'],
        ['lit-action-execution', '*'],
      ],
    },
    litClient,
  })

  const encryptedJson = JSON.parse(
    fs.readFileSync(ENCRYPTED_FILE, 'utf-8')
  )

  // OJO:
  // Para que esto funcione, usas las MISMAS condiciones con las que cifraste.
  // En tu prueba, la condición era requireWalletOwnership(address).on('ethereum').
  // Como ya vienen embebidas en el objeto cifrado, probamos a pasarlo tal cual como `data`.
  const decrypted = await litClient.decrypt({
    data: encryptedJson,
    authContext,
    chain: 'ethereum',
  })

  const pdfBytes =
    decrypted instanceof Uint8Array
      ? decrypted
      : decrypted?.decryptedData instanceof Uint8Array
      ? decrypted.decryptedData
      : new Uint8Array(decrypted)

  fs.writeFileSync('./book.decrypted.pdf', pdfBytes)

  console.log('✅ PDF descifrado en book.decrypted.pdf')
}

run().catch((err) => {
  console.error('❌ Error al descifrar:', err)
})