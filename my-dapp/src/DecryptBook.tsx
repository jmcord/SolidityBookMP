import { useState } from 'react'
import { useAccount } from 'wagmi'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { MARKETPLACE_ADDRESS } from './contracts'
import { createWalletClient, custom, getAddress } from 'viem'
import { Buffer } from 'buffer'

// FIX: Buffer para navegador
window.Buffer = Buffer

type Props = {
  encryptedFileUrl: string
  encryptedKeyUrl: string
  ownsBook: boolean
  bookId: string
}

export default function DecryptBook({
  encryptedFileUrl,
  encryptedKeyUrl,
  ownsBook,
  bookId,
}: Props) {
  const { address } = useAccount()

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')

  const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  const handleDecrypt = async () => {
    try {
      if (!address) {
        setStatus('Conecta la wallet primero')
        return
      }

      if (!ownsBook) {
        setStatus('No tienes este libro')
        return
      }

      if (!encryptedFileUrl || !encryptedKeyUrl) {
        setStatus('Faltan encrypted_file o encrypted_key en metadata')
        return
      }

      setLoading(true)
      setStatus('Descargando archivos cifrados...')

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl('')
      }

      const [fileRes, keyRes] = await Promise.all([
        fetch(encryptedFileUrl),
        fetch(encryptedKeyUrl),
      ])

      if (!fileRes.ok) throw new Error(`Error descargando encrypted_file: ${fileRes.status}`)
      if (!keyRes.ok) throw new Error(`Error descargando encrypted_key: ${keyRes.status}`)

      const encryptedPdf = await fileRes.arrayBuffer()
      const encryptedKeyJson = await keyRes.json()

      setStatus('Conectando con Lit...')

      const litClient = await createLitClient({ network: nagaDev })

      const authManager = createAuthManager({
        storage: storagePlugins.localStorage({
          appName: 'book-marketplace',
          networkName: 'naga-dev',
          localStorage: window.localStorage,
        }),
      })


      const provider = (window as any).ethereum
      if (!provider) throw new Error('MetaMask no está disponible')

      await provider.request({ method: 'eth_requestAccounts' })

      const walletClient = createWalletClient({
        transport: custom(provider),
      })

      const [rawAddress] = await walletClient.getAddresses()
      if (!rawAddress) throw new Error('No se pudo obtener la wallet seleccionada')

      const selectedAddress = getAddress(rawAddress)

      setStatus('Firmando autenticación...')

      const authContext = await authManager.createEoaAuthContext({
        config: {
          account: {
            address: selectedAddress,
            signMessage: async ({ message }: { message: string }) => {
              return await walletClient.signMessage({
                account: selectedAddress as `0x${string}`,
                message,
              })
            },
          } as any,
        },
              authConfig: {
          domain: window.location.host,
          statement: 'Decrypt book',
          expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          resources: [
            ['access-control-condition-decryption', '*'],
            ['lit-action-execution', '*'],
          ],
        },
        litClient,
      })

      setStatus('Descifrando clave AES con Lit...')

      const decryptedKeyResult = await litClient.decrypt({
        data: encryptedKeyJson,
        evmContractConditions: [
          {
            contractAddress: MARKETPLACE_ADDRESS as `0x${string}`,
            //chain: 'sepolia',
            chain: 'polygon',
            functionName: 'hasUserBook',
            functionParams: [':userAddress', bookId],
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
        chain: 'sepolia',
        authContext,
      })

      console.log('Lit decryptedKeyResult:', decryptedKeyResult)

      let decryptedText = ''

      if (decryptedKeyResult instanceof Uint8Array) {
        decryptedText = new TextDecoder().decode(decryptedKeyResult)
      } else if (decryptedKeyResult?.decryptedData instanceof Uint8Array) {
        decryptedText = new TextDecoder().decode(decryptedKeyResult.decryptedData)
      } else if (typeof decryptedKeyResult === 'string') {
        decryptedText = decryptedKeyResult
      } else if (typeof decryptedKeyResult?.decryptedData === 'string') {
        decryptedText = decryptedKeyResult.decryptedData
      }

      console.log('Texto descifrado por Lit:', decryptedText)

      if (!decryptedText || decryptedText === 'undefined') {
        throw new Error(
          'Lit no pudo descifrar la clave. Revisa que el bookId coincida, que hayas comprado el libro con esta wallet y que el contrato sea el mismo.'
        )
      }

      let decoded: any

      try {
        decoded = JSON.parse(decryptedText)
      } catch {
        throw new Error(`Lit devolvió un texto no JSON: ${decryptedText}`)
      }

      if (!decoded?.key || !decoded?.iv) {
        throw new Error('La clave descifrada no contiene key o iv')
      }

      if (!decoded?.key || !decoded?.iv) {
        throw new Error('La clave descifrada no contiene key o iv')
      }

      const aesKey = base64ToUint8Array(decoded.key)
      const iv = base64ToUint8Array(decoded.iv)

      setStatus('Descifrando PDF...')

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        aesKey,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      )

      const decryptedPdf = await window.crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        encryptedPdf
      )

      const blob = new Blob([decryptedPdf], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setPdfUrl(url)
      setStatus('✅ Libro descifrado correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(error?.message || 'Error al descifrar el libro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={handleDecrypt}
        disabled={loading || !ownsBook || !encryptedFileUrl || !encryptedKeyUrl}
      >
        {loading ? 'Descifrando...' : 'Leer libro'}
      </button>

      {status && (
        <p style={{ marginTop: 12 }}>
          <strong>Estado:</strong> {status}
        </p>
      )}

      {pdfUrl && (
        <div style={{ marginTop: 16 }}>
          <iframe
            src={pdfUrl}
            title="Libro PDF"
            style={{
              width: '100%',
              height: '700px',
              border: '1px solid #ccc',
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </div>
  )
}
