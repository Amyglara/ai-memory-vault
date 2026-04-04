import { createWeb3Modal } from '@web3modal/wagmi/react';
import { createConfig, http } from 'wagmi';
import { walletConnect, injected } from 'wagmi/connectors';
import { zgTestnet } from '@/config';

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || '';

const metadata = {
  name: '0G Storage',
  description: 'Storage dApp',
  url: 'https://0g.ai',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

export const config = createConfig({
  chains: [zgTestnet],
  transports: {
    [zgTestnet.id]: http(zgTestnet.rpcUrls.default.http[0])
  },
  connectors: [
    injected(),
    walletConnect({ 
      projectId,
      metadata,
      showQrModal: false 
    })
  ]
});

if (typeof window !== 'undefined') {
  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    themeMode: 'light',
    featuredWalletIds: [],
    themeVariables: {
      '--w3m-font-family': 'Inter',
      '--w3m-accent': '#3b82f6'
    }
  });
} 