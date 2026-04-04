# AI Memory Vault

> Decentralized AI Agent Memory Bank — Built on 0G Network

AI Memory Vault is a full-stack decentralized application that gives AI Agents persistent, verifiable memory on the blockchain. Upload knowledge documents to 0G Storage, chat with AI via 0G Compute with RAG retrieval, and anchor proof-of-existence on-chain.

## Features

- **Decentralized Storage** — Upload & retrieve documents via 0G Storage (Merkle-verified)
- **AI Chat with RAG** — LLM inference via 0G Compute with retrieval-augmented generation
- **On-chain Anchoring** — Mint Merkle root hashes on 0G Chain for immutable proof-of-existence
- **Agent Identity** — Register AI Agent identities on-chain (INFT/ERC-7857)
- **Memory Dashboard** — Visualize stored files, chat history, and on-chain records

## 0G Components Used

| Component | Purpose |
|-----------|---------|
| 0G Storage | Persistent document storage with Merkle verification |
| 0G Compute | LLM inference (qwen-2.5-7b-instruct) with streaming |
| 0G Chain | Smart contracts for file anchoring & Agent registration |

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Wallet**: RainbowKit + wagmi + viem
- **Contracts**: Hardhat + Solidity 0.8.19 + ethers v6
- **Storage SDK**: @0glabs/0g-ts-sdk
- **Compute SDK**: @0glabs/0g-serving-broker

## Getting Started

### Prerequisites

- Node.js >= 18
- MetaMask wallet with testnet 0G tokens
- [Faucet](https://faucet.0g.ai) for testnet tokens

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ai-memory-vault.git
cd ai-memory-vault

# 2. Install dependencies
cd frontend && npm install
cd ../contracts && npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your private key and RPC URL

# 4. Deploy contracts
cd contracts && npx hardhat run scripts/deploy.ts --network galileo

# 5. Start frontend
cd frontend && npm run dev
```

## Project Structure

```
├── .0g-skills/          # 0G Agent Skills reference (14 skills)
├── frontend/            # Next.js full-stack app
│   ├── app/             # Pages & API Routes
│   ├── components/      # UI components
│   └── lib/             # SDK wrappers
├── contracts/           # Hardhat smart contracts
├── storage-starter/     # 0G Storage TS reference
├── storage-web-starter/ # 0G Storage Web (Next.js) reference
├── compute-starter/     # 0G Compute TS reference
└── storage-go-starter/  # 0G Storage Go reference
```

## Hackathon Track

0G APAC Hackathon — Track 1: Agent Infrastructure & OpenClaw Lab

## License

MIT
