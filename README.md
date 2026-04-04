# AI Memory Vault

> **Decentralized AI Agent Memory Bank** — Built on 0G Network

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live-00E5FF?style=flat-square&logo=vercel)](https://frontend-eight-indol-98.vercel.app)
[![0G Network](https://img.shields.io/badge/0G-Galileo%20Testnet-7C3AED?style=flat-square)](https://chainscan-galileo.0g.ai)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.14-black?style=flat-square&logo=next.js)](https://nextjs.org)

AI Memory Vault is a full-stack decentralized application that gives AI Agents persistent, verifiable memory on the blockchain. Upload knowledge documents to 0G Storage, chat with AI via 0G Compute with RAG retrieval, register agent identities, and anchor proof-of-existence on-chain.

## 🌐 Live Demo

**https://frontend-eight-indol-98.vercel.app**

## ✨ Features

### Core
- **Decentralized Storage** — Upload & retrieve documents via 0G Storage (Merkle-verified integrity)
- **AI Chat with RAG** — LLM inference via 0G Compute with retrieval-augmented generation from stored docs
- **On-chain Anchoring** — Mint Merkle root hashes on 0G Chain for immutable proof-of-existence
- **Agent Identity System** — Register AI Agent identities on-chain with file association
- **Real-time Dashboard** — Live on-chain statistics (total files, agents, user data)

### UX
- Cyberpunk Neon theme with Glassmorphism design
- Reown AppKit for seamless wallet connection
- Turbo/Standard network toggle for 0G Storage
- Responsive design (mobile + desktop)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Dashboard │ │  Upload  │ │   Chat   │ │ Agents  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │             │       │
│  ┌────┴────────────┴────────────┴─────────────┴────┐ │
│  │            Contract Layer (viem)                 │ │
│  │     readContract + encodeFunctionData             │ │
│  └────────┬────────────┬──────────────┬─────────────┘ │
└───────────┼────────────┼──────────────┼───────────────┘
            │            │              │
   ┌────────┴───┐  ┌─────┴─────┐  ┌───┴────────────┐
   │ 0G Storage │  │ 0G Compute│  │ MemoryVault     │
   │ (SDK)      │  │ (Broker)  │  │ (Smart Contract)│
   │            │  │           │  │                  │
   │ • Merkle   │  │ • qwen    │  │ • anchorFile    │
   │ • Upload   │  │ • RAG     │  │ • registerAgent │
   │ • Download │  │ • Stream  │  │ • linkFile      │
   └────────────┘  └───────────┘  └──────────────────┘
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15.5 + React 19 + TypeScript |
| **Styling** | Tailwind CSS 3.4 (Cyberpunk Neon theme) |
| **Wallet** | Reown AppKit + wagmi 2.x + viem 2.x |
| **Storage** | @0glabs/0g-ts-sdk 0.3.0 (Turbo/Standard) |
| **Compute** | @0glabs/0g-serving-broker 0.6.5 (streaming SSE) |
| **Contracts** | Solidity 0.8.24 + Hardhat + ethers v6 |
| **Chain** | 0G Galileo Testnet (Chain ID: 16602) |

## 📋 Smart Contract

**MemoryVault.sol** — [`0x7826Ac2d7DC10Da069498268f22E8346cB1f082b`](https://chainscan-galileo.0g.ai/address/0x7826Ac2d7DC10Da069498268f22E8346cB1f082b)

### Key Functions
| Function | Description |
|----------|-------------|
| `anchorFile(rootHash, filename, fileSize, contentType)` | Store Merkle root on-chain |
| `registerAgent(name, description, memoryRoot)` | Create AI agent identity |
| `linkFileToAgent(fileId, agentId)` | Associate file with agent |
| `getFilesByOwner(address)` | Query user's files |
| `getAgentsByOwner(address)` | Query user's agents |
| `getAgentFiles(agentId)` | Get agent's linked files |

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- MetaMask or compatible wallet
- [0G Testnet Faucet](https://faucet.0g.ai) for testnet OG tokens

### Quick Start

```bash
# 1. Clone
git clone https://github.com/Amyglara/ai-memory-vault.git
cd ai-memory-vault

# 2. Install frontend dependencies
cd frontend && npm install --legacy-peer-deps

# 3. Configure environment
cp .env.local.example .env.local
# NEXT_PUBLIC_PROJECT_ID is pre-configured for Reown AppKit

# 4. Start dev server
npm run dev
```

### Deploy Contracts (optional)

```bash
cd contracts && npm install
npx hardhat run scripts/deploy.ts --network galileo
```

## 📁 Project Structure

```
ai-memory-vault/
├── frontend/                # Next.js application
│   ├── src/
│   │   ├── app/             # Pages & API Routes
│   │   │   ├── page.tsx           # Dashboard (home)
│   │   │   ├── upload/page.tsx    # File upload to 0G Storage
│   │   │   ├── chat/page.tsx      # AI chat with RAG
│   │   │   └── agents/page.tsx    # Agent identity management
│   │   ├── components/
│   │   │   ├── pages/            # Page-level components
│   │   │   └── common/           # Shared UI components
│   │   └── lib/
│   │       ├── contracts.ts      # On-chain interaction layer
│   │       ├── storage.ts        # 0G Storage SDK wrapper
│   │       ├── compute.ts        # 0G Compute broker wrapper
│   │       ├── config.ts         # Network configuration
│   │       └── wagmi.ts          # Wallet connection
│   └── .env.local                # Environment variables
├── contracts/               # Hardhat smart contracts
│   └── contracts/
│       └── MemoryVault.sol  # Main contract
├── storage-starter/         # 0G Storage TS reference
├── storage-web-starter/     # 0G Storage Web reference
├── compute-starter/         # 0G Compute TS reference
└── storage-go-starter/      # 0G Storage Go reference
```

## 🔐 Security

- All contract writes require MetaMask wallet signature
- Merkle tree verification ensures file integrity
- No private keys stored client-side
- Environment variables are server-only (PRIVATE_KEY never exposed)

## 🏆 Hackathon

**0G APAC Hackathon** — Track 1: Agent Infrastructure & OpenClaw Lab

### User Flow
1. **Connect Wallet** — MetaMask on 0G Galileo Testnet
2. **Upload Document** — File → 0G Storage (Merkle tree) → Anchor root hash on-chain
3. **Register Agent** — Create AI agent identity with name, description, memory root
4. **Link Files** — Associate stored documents with agent for RAG context
5. **AI Chat** — Query AI with RAG retrieval from agent's linked documents

## 📝 License

MIT
