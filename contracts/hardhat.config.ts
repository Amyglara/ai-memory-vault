/* eslint-disable @typescript-eslint/no-require-imports */
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun', // REQUIRED for 0G Chain
      viaIR: true, // Required for complex contracts (prevents StackTooDeep)
    },
  },
  networks: {
    '0g-testnet': {
      url: process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai',
      chainId: 16602,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    '0g-mainnet': {
      url: process.env.MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
      chainId: 16661,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      '0g-testnet': process.env.ETHERSCAN_API_KEY || 'placeholder',
      '0g-mainnet': process.env.ETHERSCAN_API_KEY || 'placeholder',
    },
    customChains: [
      {
        network: '0g-testnet',
        chainId: 16602,
        urls: {
          apiURL: 'https://chainscan-galileo.0g.ai/open/api',
          browserURL: 'https://chainscan-galileo.0g.ai',
        },
      },
      {
        network: '0g-mainnet',
        chainId: 16661,
        urls: {
          apiURL: 'https://chainscan.0g.ai/open/api',
          browserURL: 'https://chainscan.0g.ai',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
