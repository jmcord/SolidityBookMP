import ReactDOM from 'react-dom/client'
import App from './App'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
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