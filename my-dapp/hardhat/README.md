# Sample Hardhat 3 Beta Project (minimal)

This project has a minimal setup of Hardhat 3 Beta, without any plugins.

## What's included?

The project includes native support for TypeScript, Hardhat scripts, tasks, and support for Solidity compilation and tests.

## Deploy completo: Frontend, Backend y Blockchain

Este proyecto tiene 3 partes separadas:

```txt
Frontend React/Vite  → Vercel
Backend Express      → Render
Smart contracts      → Sepolia / Polygon
1. Frontend en Vercel

Vercel sirve la dapp pública.

El usuario entra desde una URL tipo:

https://solidity-book-mp.vercel.app

El frontend permite:

conectar MetaMask
registrarse
comprar BMT
aprobar gasto de tokens
comprar libros
leer libros si Lit valida ownership
Configuración Vercel

Root directory:

my-dapp

Build command:

npm run build

Output directory:

dist
Importante

Cada vez que cambien direcciones de contratos o URLs del backend:

git add .
git commit -m "update deployment config"
git push

Vercel redeployará automáticamente.

2. Backend en Render

El backend está en:

server/upload-book-server.js

Render se usa porque el backend:

recibe archivos PDF y portada
cifra el PDF con AES
cifra la clave AES con Lit Protocol
sube archivos a Pinata/IPFS
devuelve el metadataURI

No se recomienda meter este backend en Vercel porque maneja archivos, buffers, crypto y secretos.

Configuración Render

Crear:

New Web Service

Valores:

Root Directory: my-dapp/server
Build Command: npm install
Start Command: node upload-book-server.js

Variable de entorno:

PINATA_JWT=tu_jwt_de_pinata
Puerto en Render

El backend debe usar process.env.PORT:

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`✅ Upload server running on port ${PORT}`)
})
CORS

El backend debe permitir la URL de Vercel:

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://solidity-book-mp.vercel.app'
  ],
}))

Para pruebas rápidas se puede usar temporalmente:

app.use(cors({ origin: true }))
3. Conectar frontend con backend

En EncryptBook.tsx, la llamada local:

fetch('http://localhost:4000/api/upload-book')

debe cambiarse en producción por la URL de Render:

fetch('https://soliditybookmp-1.onrender.com/api/upload-book')

Si sale:

Failed to fetch

normalmente significa:

backend apagado
URL incorrecta
CORS mal configurado
Render aún redeployando
Render dormido en free tier
4. Deploy de contratos con Hardhat

Hardhat está en:

hardhat/

Sirve para compilar y desplegar:

BookToken
BookNFT
BookMarketplace
Instalar

Desde hardhat/:

npm install

Si se instala desde cero:

npm install --save-dev hardhat@2.22.3 @nomicfoundation/hardhat-toolbox@hh2 dotenv
npm install @openzeppelin/contracts@4.9.6
Configuración

Archivo:

hardhat/hardhat.config.js

Ejemplo:

require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

const PRIVATE_KEY = process.env.PRIVATE_KEY || ""

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      chainId: 137,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
}

Archivo:

hardhat/.env

Ejemplo:

PRIVATE_KEY=tu_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/TU_API_KEY
POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com

No subir .env a GitHub.

5. Compilar contratos

Desde hardhat/:

npx hardhat compile

Si compila bien:

Compiled Solidity files successfully
6. Deploy

Script:

hardhat/scripts/deploy.js

Despliegue en Sepolia:

npx hardhat run scripts/deploy.js --network sepolia

Despliegue en Polygon:

npx hardhat run scripts/deploy.js --network polygon

El script devuelve:

TOKEN_ADDRESS = 0x...
NFT_ADDRESS = 0x...
MARKETPLACE_ADDRESS = 0x...

Estas direcciones deben copiarse en:

src/contracts.ts

y también el marketplace en:

server/upload-book-server.js
encrypt.js
decrypt.js
DecryptBook.tsx
7. Ownership tras deploy

El marketplace debe ser owner de BookToken y BookNFT.

Esto es obligatorio porque el marketplace llama a:

paymentToken.mint(...)
bookNFT.mintBookNFT(...)

Ambas funciones tienen onlyOwner.

El script de deploy debe ejecutar:

await token.transferOwnership(marketplace.address)
await nft.transferOwnership(marketplace.address)

Si esto no se hace, buyBook fallará.

8. Configurar red en frontend

En main.tsx, para Polygon:

import ReactDOM from 'react-dom/client'
import App from './App'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const config = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
  },
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
)

En cada writeContractAsync, añadir:

chainId: polygon.id

Ejemplo:

const hash = await writeContractAsync({
  address: MARKETPLACE_ADDRESS as `0x${string}`,
  abi: MARKETPLACE_ABI,
  functionName: 'register',
  args: [username.trim()],
  chainId: polygon.id,
  gas: 300000n,
})

Para buyBook, puede hacer falta más gas:

gas: 900000n
9. Configurar Lit Protocol

Lit valida si el usuario compró el libro llamando al contrato:

hasUserBook(user, bookId)

Por eso el MARKETPLACE_ADDRESS, la red y el bookId deben coincidir exactamente.

Sepolia
chain: 'sepolia'
Polygon
chain: 'polygon'

Archivos a revisar:

server/upload-book-server.js
DecryptBook.tsx
encrypt.js
decrypt.js

Si se cambia de red o de contrato, hay que cifrar libros nuevos.

10. Flujo correcto para crear/comprar/leer libro

Después de un deploy nuevo, todo empieza desde cero.

Orden recomendado:

1. Cambiar addresses en frontend y backend
2. Cambiar chain de Lit si cambia la red
3. Redeploy Render
4. Redeploy Vercel
5. Conectar MetaMask a la red correcta
6. Registrarse
7. Comprar BMT
8. Cifrar/subir libro con bookId correcto
9. Crear libro con el metadataURI generado
10. Approve
11. Comprar libro
12. Leer libro
11. Relación crítica entre bookId y Lit

El bookId usado al cifrar debe coincidir con el ID real del contrato.

Ejemplo correcto:

EncryptBook bookId = 1
createBook genera ID = 1
buyBook(1)
DecryptBook bookId = 1

Ejemplo incorrecto:

EncryptBook bookId = 2
createBook genera ID = 1
buyBook(1)

En ese caso Lit no libera la clave.

12. MetaMask
Polygon Mainnet

Añadir red manualmente si no aparece:

Network Name: Polygon Mainnet
RPC URL: https://polygon-rpc.com
Chain ID: 137
Currency Symbol: POL
Block Explorer: https://polygonscan.com

La wallet necesita POL real para gas.

Sepolia

La wallet necesita ETH Sepolia para gas.

13. Errores comunes
Failed to fetch

Frontend no puede llamar al backend.

Revisar:

URL de Render
CORS
backend live
redeploy de Vercel
401 Unauthorized en Polygon RPC

El RPC usado no funciona.

Cambiar en main.tsx:

http('https://polygon-bor-rpc.publicnode.com')
No chain was provided to the request

Falta chainId en writeContractAsync.

Añadir:

chainId: polygon.id
Current Chain ID ... Expected Chain ID ...

MetaMask está en otra red.

Cambiar MetaMask a la red correcta y recargar.

transaction gas limit too high

Puede ser:

RPC malo
estimación de gas rota
falta gas fijo en la tx

Añadir gas manual:

gas: 300000n

o para buyBook:

gas: 900000n
Decryption failed

Lit no pudo liberar la clave.

Causas frecuentes:

metadata vieja
libro cifrado con otro marketplace
bookId no coincide
red incorrecta en Lit
usuario no compró realmente ese bookId
User denied transaction signature

El usuario rechazó la firma en MetaMask.

Repetir y aceptar.

insufficient funds for gas

La wallet no tiene ETH/POL suficiente.

14. Qué debe hacer alguien tras clonar el repo
git clone <repo>
cd my-dapp
npm install

Crear .env del backend:

server/.env
PINATA_JWT=...

Crear .env de Hardhat:

hardhat/.env
PRIVATE_KEY=...
SEPOLIA_RPC_URL=...
POLYGON_RPC_URL=...

Instalar backend:

cd server
npm install
node upload-book-server.js

Instalar y compilar contratos:

cd ../hardhat
npm install
npx hardhat compile

Frontend local:

cd ..
npm run dev

Producción:

frontend en Vercel
backend en Render
contratos en Sepolia o Polygon