import { useEffect, useMemo, useState } from 'react'
import EncryptBook from './EncryptBook'
import DecryptBook from './DecryptBook'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { formatEther, parseEther } from 'viem'
import {
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  TOKEN_ADDRESS,
  TOKEN_ABI,
} from './contracts'

type BookData = {
  id: bigint
  title: string
  author: string
  priceInTokens: bigint
  metadataURI: string
  active: boolean
  totalSales: bigint
}

type NftMetadata = {
  name?: string
  description?: string
  image?: string
  encrypted_file?: string
  encrypted_key?: string
  mime_type?: string
  external_url?: string
  attributes?: Array<{
    trait_type?: string
    value?: string
  }>
}

const IPFS_GATEWAYS = [
  'https://crimson-quickest-pinniped-725.mypinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
]

const isValidIpfsUri = (uri: string) => {
  if (!uri.startsWith('ipfs://')) return false
  const cid = uri.replace('ipfs://', '').trim()
  return cid.length > 20 && !cid.includes(' ') && cid !== 'mi-libro'
}

const ipfsToHttp = (uri: string, gatewayIndex = 0) => {
  if (!uri) return ''

  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '').trim()
    return `${IPFS_GATEWAYS[gatewayIndex]}${cid}`
  }

  return uri
}

const fetchJsonFromIpfs = async <T,>(uri: string): Promise<T> => {
  if (!isValidIpfsUri(uri)) {
    throw new Error(`Metadata URI inválida: ${uri}`)
  }

  let lastError: unknown = null

  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const url = ipfsToHttp(uri, i)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Gateway ${i + 1}: ${response.status}`)
      }

      return (await response.json()) as T
    } catch (error) {
      console.warn('IPFS gateway failed:', url, error)
      lastError = error
    }
  }

  throw lastError ?? new Error('No se pudo cargar desde ningún gateway IPFS')
}

function App() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [username, setUsername] = useState('')
  const [ethToSpend, setEthToSpend] = useState('0.1')
  const [status, setStatus] = useState('')

  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [bookPrice, setBookPrice] = useState('100')
  const [bookMetadata, setBookMetadata] = useState('')

  const [selectedBookId, setSelectedBookId] = useState('1')
  const currentBookId = BigInt(selectedBookId || '1')

  const [nftMetadata, setNftMetadata] = useState<NftMetadata | null>(null)
  const [metadataError, setMetadataError] = useState('')

  const { data: isRegistered, refetch: refetchRegistered } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'getTokenBalance',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'getTokenAllowance',
    args: address
      ? [address, MARKETPLACE_ADDRESS as `0x${string}`]
      : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: book, refetch: refetchBook } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'getBook',
    args: [currentBookId],
    query: { enabled: true },
  })

  const { data: ownsBook, refetch: refetchOwnsBook } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'hasUserBook',
    args: address ? [address, currentBookId] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: ownerAddress } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'owner',
    query: { enabled: true },
  })

  const isOwner =
    address && ownerAddress
      ? address.toLowerCase() === (ownerAddress as string).toLowerCase()
      : false

  const price = useMemo(() => {
    if (!book) return 0n
    const b = book as BookData
    return b.priceInTokens
  }, [book])

  const refreshAll = async () => {
    await Promise.all([
      refetchRegistered(),
      refetchBalance(),
      refetchAllowance(),
      refetchBook(),
      refetchOwnsBook(),
    ])
  }

  const waitAndRefresh = async (hash: `0x${string}`) => {
    if (!publicClient) throw new Error('Public client no disponible')
    await publicClient.waitForTransactionReceipt({ hash })
    await refreshAll()
  }

  const loadMetadata = async (metadataUri: string) => {
    try {
      setMetadataError('')
      setNftMetadata(null)

      if (!metadataUri) return

      console.log('Metadata URI usado:', metadataUri)

      const json = await fetchJsonFromIpfs<NftMetadata>(metadataUri)
      setNftMetadata(json)
    } catch (error: any) {
      console.error(error)
      setMetadataError(error?.message || 'Error cargando metadata')
    }
  }

  useEffect(() => {
    const currentBook = book as BookData | undefined

    if (currentBook?.metadataURI) {
      void loadMetadata(currentBook.metadataURI)
    } else {
      setNftMetadata(null)
      setMetadataError('')
    }
  }, [book])

  const handleRegister = async () => {
    try {
      setStatus('Registrando usuario...')

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'register',
        args: [username.trim()],
      })

      setStatus('Esperando confirmación del registro...')
      await waitAndRefresh(hash)
      setStatus('✅ Usuario registrado correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(
        `Error al registrar: ${
          error?.shortMessage || error?.message || 'desconocido'
        }`
      )
    }
  }

  const handleBuyTokens = async () => {
    try {
      setStatus('Comprando tokens...')

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'buyTokens',
        value: parseEther(ethToSpend || '0'),
      })

      setStatus('Esperando confirmación de compra de tokens...')
      await waitAndRefresh(hash)
      setStatus('✅ Tokens comprados correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(
        `Error al comprar tokens: ${
          error?.shortMessage || error?.message || 'desconocido'
        }`
      )
    }
  }

  const handleCreateBook = async () => {
    try {
      const metadata = bookMetadata.trim()

      if (!isValidIpfsUri(metadata)) {
        throw new Error(
          'Metadata URI inválida. Debe ser algo como ipfs://Qm... y no "mi-libro".'
        )
      }

      setStatus('Creando libro...')

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'createBook',
        args: [
          bookTitle.trim(),
          bookAuthor.trim(),
          parseEther(bookPrice || '0'),
          metadata,
        ],
      })

      setStatus('Esperando confirmación de creación del libro...')
      await waitAndRefresh(hash)
      setStatus('✅ Libro creado correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(
        `Error al crear libro: ${
          error?.shortMessage || error?.message || 'desconocido'
        }`
      )
    }
  }

  const handleApprove = async () => {
    try {
      setStatus('Haciendo approve...')

      const hash = await writeContractAsync({
        address: TOKEN_ADDRESS as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [MARKETPLACE_ADDRESS as `0x${string}`, price],
      })

      setStatus('Esperando confirmación del approve...')
      await waitAndRefresh(hash)
      setStatus('✅ Approve realizado correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(
        `Error en approve: ${
          error?.shortMessage || error?.message || 'desconocido'
        }`
      )
    }
  }

  const handleBuyBook = async () => {
    try {
      setStatus('Comprando libro...')

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'buyBook',
        args: [currentBookId],
      })

      setStatus('Esperando confirmación de compra del libro...')
      await waitAndRefresh(hash)
      setStatus('✅ Libro comprado correctamente')
    } catch (error: any) {
      console.error(error)
      setStatus(
        `Error al comprar libro: ${
          error?.shortMessage || error?.message || 'desconocido'
        }`
      )
    }
  }

  const formattedBalance = balance ? formatEther(balance as bigint) : '0'
  const formattedAllowance = allowance ? formatEther(allowance as bigint) : '0'
  const formattedPrice = price ? formatEther(price) : '0'

  const bookData = book as BookData | undefined

  const imageUrl = nftMetadata?.image ? ipfsToHttp(nftMetadata.image) : ''

  const encryptedFileUrl = nftMetadata?.encrypted_file
    ? ipfsToHttp(nftMetadata.encrypted_file)
    : ''

  const encryptedKeyUrl = nftMetadata?.encrypted_key
    ? ipfsToHttp(nftMetadata.encrypted_key)
    : ''

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 900,
        margin: '0 auto',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>📚 Book Marketplace</h1>

      {!isConnected ? (
        <button onClick={() => connect({ connector: injected() })}>
          Conectar wallet
        </button>
      ) : (
        <>
          <p>
            <strong>Wallet:</strong> {address}
          </p>

          <button onClick={() => disconnect()}>Desconectar</button>

          <hr style={{ margin: '24px 0' }} />

          <h2>Estado</h2>

          <p>
            <strong>Registrado:</strong> {isRegistered ? 'Sí' : 'No'}
          </p>

          <p>
            <strong>Balance BMT:</strong> {formattedBalance}
          </p>

          <p>
            <strong>Allowance al marketplace:</strong> {formattedAllowance}
          </p>

          <p>
            <strong>¿Ya tienes el libro seleccionado?</strong>{' '}
            {ownsBook ? 'Sí' : 'No'}
          </p>

          <hr style={{ margin: '24px 0' }} />

          <h2>Registro</h2>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu username"
            style={{ padding: 8, marginRight: 8 }}
          />

          <button
            onClick={handleRegister}
            disabled={!username.trim() || Boolean(isRegistered)}
          >
            Registrarme
          </button>

          <hr style={{ margin: '24px 0' }} />

          <h2>Comprar tokens</h2>

          <input
            value={ethToSpend}
            onChange={(e) => setEthToSpend(e.target.value)}
            placeholder="ETH"
            style={{ padding: 8, marginRight: 8 }}
          />

          <button onClick={handleBuyTokens}>Comprar BMT</button>

          <hr style={{ margin: '24px 0' }} />

          <h2>Crear libro</h2>

          {isOwner ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Título"
                style={{ padding: 8 }}
              />

              <input
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                placeholder="Autor"
                style={{ padding: 8 }}
              />

              <input
                value={bookPrice}
                onChange={(e) => setBookPrice(e.target.value)}
                placeholder="Precio en BMT"
                style={{ padding: 8 }}
              />

              <input
                value={bookMetadata}
                onChange={(e) => setBookMetadata(e.target.value)}
                placeholder="Metadata URI real, ej: ipfs://Qm..."
                style={{ padding: 8 }}
              />

              <button
                onClick={handleCreateBook}
                disabled={
                  !bookTitle.trim() ||
                  !bookAuthor.trim() ||
                  !bookPrice.trim() ||
                  !isValidIpfsUri(bookMetadata.trim())
                }
              >
                Crear libro
              </button>

              {bookMetadata.trim() && !isValidIpfsUri(bookMetadata.trim()) && (
                <p style={{ color: 'red' }}>
                  La metadata debe ser un URI real de IPFS, por ejemplo:
                  ipfs://Qm...
                </p>
              )}
            </div>
          ) : (
            <p>Solo el owner puede crear libros.</p>
          )}

          <hr style={{ margin: '24px 0' }} />

          <h2>Seleccionar libro</h2>

          <input
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            placeholder="ID del libro"
            style={{ padding: 8, marginRight: 8 }}
          />

          <button onClick={() => void refreshAll()}>Cargar libro</button>

          <hr style={{ margin: '24px 0' }} />

          <h2>Libro</h2>

          {bookData ? (
            <div
              style={{
                border: '1px solid #ccc',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <p>
                <strong>ID:</strong> {bookData.id.toString()}
              </p>

              <p>
                <strong>Título:</strong> {bookData.title}
              </p>

              <p>
                <strong>Autor:</strong> {bookData.author}
              </p>

              <p>
                <strong>Precio:</strong> {formattedPrice} BMT
              </p>

              <p>
                <strong>Activo:</strong> {bookData.active ? 'Sí' : 'No'}
              </p>

              <p>
                <strong>Ventas:</strong> {bookData.totalSales.toString()}
              </p>

              <p>
                <strong>Metadata URI:</strong> {bookData.metadataURI}
              </p>

              {!isValidIpfsUri(bookData.metadataURI) && (
                <p style={{ color: 'red' }}>
                  Este libro tiene una metadata inválida guardada en el contrato.
                  Debes crear otro libro con una metadata ipfs://Qm... real.
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                <button onClick={handleApprove} disabled={!price}>
                  Approve
                </button>

                <button
                  onClick={handleBuyBook}
                  disabled={
                    !bookData.active || Boolean(ownsBook) || !isRegistered
                  }
                >
                  Comprar libro
                </button>

                <button onClick={() => void refreshAll()}>
                  Refrescar datos
                </button>
              </div>

              <hr style={{ margin: '24px 0' }} />

              <h3>Metadata NFT</h3>

              {metadataError && <p style={{ color: 'red' }}>Error metadata: {metadataError}</p>}

              {nftMetadata && (
                <>
                  <p>
                    <strong>Nombre:</strong> {nftMetadata.name || '-'}
                  </p>

                  <p>
                    <strong>Descripción:</strong>{' '}
                    {nftMetadata.description || '-'}
                  </p>

                  <p>
                    <strong>Encrypted file:</strong>{' '}
                    {nftMetadata.encrypted_file || '-'}
                  </p>

                  <p>
                    <strong>Encrypted key:</strong>{' '}
                    {nftMetadata.encrypted_key || '-'}
                  </p>

                  {Array.isArray(nftMetadata.attributes) &&
                    nftMetadata.attributes.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <strong>Atributos:</strong>

                        <ul>
                          {nftMetadata.attributes.map((attr, index) => (
                            <li key={index}>
                              {attr.trait_type}: {String(attr.value ?? '')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {imageUrl && (
                    <div style={{ marginBottom: 16 }}>
                      <strong>Portada</strong>

                      <div>
                        <img
                          src={imageUrl}
                          alt={nftMetadata.name || 'Portada'}
                          style={{
                            maxWidth: 280,
                            borderRadius: 8,
                            marginTop: 8,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <DecryptBook
                    encryptedFileUrl={encryptedFileUrl}
                    encryptedKeyUrl={encryptedKeyUrl}
                    ownsBook={Boolean(ownsBook)}
                    bookId={selectedBookId}
                  />
                </>
              )}
            </div>
          ) : (
            <p>No se pudo cargar el libro {selectedBookId}.</p>
          )}

          {status && (
            <>
              <hr style={{ margin: '24px 0' }} />

              <p>
                <strong>Estado:</strong> {status}
              </p>
            </>
          )}

          {isOwner && (
            <>
              <hr style={{ margin: '24px 0' }} />

              <EncryptBook />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default App