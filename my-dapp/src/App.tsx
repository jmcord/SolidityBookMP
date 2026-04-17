import { useMemo, useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { formatEther, parseEther } from 'viem'

const MARKETPLACE_ADDRESS = '0xTU_MARKETPLACE'
const TOKEN_ADDRESS = '0xTU_BOOKTOKEN'

const marketplaceAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'username', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buyTokens',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buyBook',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bookId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMyTokenBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getMyAllowanceToMarketplace',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getBook',
    stateMutability: 'view',
    inputs: [{ name: 'bookId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'title', type: 'string' },
          { name: 'author', type: 'string' },
          { name: 'priceInTokens', type: 'uint256' },
          { name: 'metadataURI', type: 'string' },
          { name: 'active', type: 'bool' },
          { name: 'totalSales', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'hasUserBook',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'bookId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const tokenAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const BOOK_ID = 1n

function App() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()

  const [username, setUsername] = useState('')
  const [ethToSpend, setEthToSpend] = useState('0.1')
  const [status, setStatus] = useState<string>('')

  const { data: isRegistered, refetch: refetchRegistered } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'getMyTokenBalance',
    query: { enabled: isConnected },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'getMyAllowanceToMarketplace',
    query: { enabled: isConnected },
  })

  const { data: book, refetch: refetchBook } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'getBook',
    args: [BOOK_ID],
    query: { enabled: true },
  })

  const { data: ownsBook, refetch: refetchOwnsBook } = useReadContract({
    address: MARKETPLACE_ADDRESS as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'hasUserBook',
    args: address ? [address, BOOK_ID] : undefined,
    query: { enabled: Boolean(address) },
  })

  const price = useMemo(() => {
    if (!book) return 0n
    const b = book as {
      id: bigint
      title: string
      author: string
      priceInTokens: bigint
      metadataURI: string
      active: boolean
      totalSales: bigint
    }
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

  const handleRegister = async () => {
    try {
      setStatus('Registrando usuario...')
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: marketplaceAbi,
        functionName: 'register',
        args: [username],
      })
      setStatus(`Registro enviado: ${hash}`)
      setTimeout(() => void refreshAll(), 2000)
    } catch (error) {
      console.error(error)
      setStatus('Error al registrar')
    }
  }

  const handleBuyTokens = async () => {
    try {
      setStatus('Comprando tokens...')
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: marketplaceAbi,
        functionName: 'buyTokens',
        value: parseEther(ethToSpend || '0'),
      })
      setStatus(`Compra de tokens enviada: ${hash}`)
      setTimeout(() => void refreshAll(), 2000)
    } catch (error) {
      console.error(error)
      setStatus('Error al comprar tokens')
    }
  }

  const handleApprove = async () => {
    try {
      setStatus('Haciendo approve...')
      const hash = await writeContractAsync({
        address: TOKEN_ADDRESS as `0x${string}`,
        abi: tokenAbi,
        functionName: 'approve',
        args: [MARKETPLACE_ADDRESS as `0x${string}`, price],
      })
      setStatus(`Approve enviado: ${hash}`)
      setTimeout(() => void refreshAll(), 2000)
    } catch (error) {
      console.error(error)
      setStatus('Error en approve')
    }
  }

  const handleBuyBook = async () => {
    try {
      setStatus('Comprando libro...')
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: marketplaceAbi,
        functionName: 'buyBook',
        args: [BOOK_ID],
      })
      setStatus(`Compra enviada: ${hash}`)
      setTimeout(() => void refreshAll(), 2000)
    } catch (error) {
      console.error(error)
      setStatus('Error al comprar libro')
    }
  }

  const formattedBalance = balance ? formatEther(balance as bigint) : '0'
  const formattedAllowance = allowance ? formatEther(allowance as bigint) : '0'
  const formattedPrice = price ? formatEther(price) : '0'

  const bookData = book as
    | {
        id: bigint
        title: string
        author: string
        priceInTokens: bigint
        metadataURI: string
        active: boolean
        totalSales: bigint
      }
    | undefined

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>📚 Book Marketplace</h1>

      {!isConnected ? (
        <button onClick={() => connect({ connector: injected() })}>
          Conectar wallet
        </button>
      ) : (
        <>
          <p><strong>Wallet:</strong> {address}</p>
          <button onClick={() => disconnect()}>Desconectar</button>

          <hr style={{ margin: '24px 0' }} />

          <h2>Estado</h2>
          <p><strong>Registrado:</strong> {isRegistered ? 'Sí' : 'No'}</p>
          <p><strong>Balance BMT:</strong> {formattedBalance}</p>
          <p><strong>Allowance al marketplace:</strong> {formattedAllowance}</p>
          <p><strong>¿Ya tienes el libro?</strong> {ownsBook ? 'Sí' : 'No'}</p>

          <hr style={{ margin: '24px 0' }} />

          <h2>Registro</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu username"
            style={{ padding: 8, marginRight: 8 }}
          />
          <button onClick={handleRegister} disabled={!username.trim() || Boolean(isRegistered)}>
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

          <h2>Libro</h2>
          {bookData ? (
            <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
              <p><strong>ID:</strong> {bookData.id.toString()}</p>
              <p><strong>Título:</strong> {bookData.title}</p>
              <p><strong>Autor:</strong> {bookData.author}</p>
              <p><strong>Precio:</strong> {formattedPrice} BMT</p>
              <p><strong>Activo:</strong> {bookData.active ? 'Sí' : 'No'}</p>
              <p><strong>Ventas:</strong> {bookData.totalSales.toString()}</p>
              <p><strong>Metadata:</strong> {bookData.metadataURI}</p>

              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={handleApprove} disabled={!price}>
                  Approve
                </button>
                <button onClick={handleBuyBook} disabled={!bookData.active || Boolean(ownsBook)}>
                  Comprar libro
                </button>
                <button onClick={() => void refreshAll()}>
                  Refrescar datos
                </button>
              </div>
            </div>
          ) : (
            <p>No se pudo cargar el libro 1.</p>
          )}

          {status && (
            <>
              <hr style={{ margin: '24px 0' }} />
              <p><strong>Estado:</strong> {status}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default App