# TrustGate

> **Decentralized Escrow & AI-Powered Arbitration Protocol** — Built on 0G Network

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live-00E5FF?style=flat-square&logo=vercel)](https://0g.bitdong.xyz)
[![0G Network](https://img.shields.io/badge/0G-Galileo%20Testnet-7C3AED?style=flat-square)](https://chainscan-galileo.0g.ai)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.14-black?style=flat-square&logo=next.js)]
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity)]

TrustGate is a full-stack decentralized escrow protocol with AI-powered dispute resolution. Create trust-backed agreements, lock funds in smart contracts, submit evidence to decentralized storage, and let AI + community arbitrators resolve disputes fairly.

## 🌐 Live Demo

**https://0g.bitdong.xyz**

## ✨ Features

### Core Protocol
- **Escrow Creation** — Buyers create trust-backed agreements specifying seller, amount, description, and time-locked deadline
- **Fund Locking** — Native token (OG) deposits are held securely in the smart contract
- **Evidence Anchoring** — Both parties submit evidence to 0G Storage; Merkle root hashes anchor data integrity on-chain
- **Dispute Resolution** — AI analyzes evidence via 0G Compute + community arbitrators vote with weighted consensus
- **Auto Distribution** — Funds automatically distribute based on combined AI + arbitrator verdict
- **Safety Mechanisms** — Time-locked refunds, pull-payment pattern to prevent reentrancy, party-only voting restrictions

### AI Arbitration (0G Compute)
- **DeepSeek R1 70B** model for reasoning-heavy dispute analysis
- Evidence retrieved from 0G Storage as RAG context
- Returns structured verdict: `{ buyerWins, confidence, reasoning }`
- AI verdict hash recorded on-chain for immutability

### Hybrid Arbitration Mechanism
- AI produces an advisory verdict with confidence score
- 3 arbitrators cast independent votes (simple majority)
- Arbitrators cannot vote on their own escrows
- Resolution triggers automatic fund distribution

### Frontend
- 4 functional pages: Dashboard, Create Escrow, Disputes, Evidence Library
- Real-time wallet connection via Reown AppKit (OKX Wallet, MetaMask, etc.)
- EN/ZH bilingual (i18n)
- Cyberpunk Neon design theme with glassmorphism
- Responsive design (mobile + desktop)

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Frontend [Next.js Frontend]
        Dashboard[/ Dashboard]
        Create[/create]
        Disputes[/disputes]
        Evidence[/evidence]
    end

    subgraph ContractLayer [contracts.ts]
        Reads[Read Functions]
        Writes[Write Functions via wagmi]
    end

    subgraph OnChain [0G Galileo Testnet]
        Escrow[TrustGateEscrow.sol]
    end

    subgraph Services [0G Services]
        Storage[0G Storage]
        Compute[0G Compute - DeepSeek R1]
    end

    Dashboard --> Reads
    Create --> Writes
    Disputes --> Reads & Writes
    Evidence --> Reads
    Reads --> Escrow
    Writes --> Escrow
    Disputes --> Storage
    Disputes --> Compute
```

## 📁 Project Structure

```
/Users/bitdong/Projects/0g-hackathon/
├── contracts/
│   ├── contracts/TrustGateEscrow.sol   # Core escrow + evidence + arbitration contract
│   ├── scripts/deploy.ts               # Deployment script
│   └── test/TrustGateEscrow.test.ts    # 44/44 tests passing
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Dashboard
│   │   │   ├── create/page.tsx         # Create escrow form
│   │   │   ├── disputes/page.tsx       # Manage disputes + evidence + AI arbitration
│   │   │   ├── evidence/page.tsx       # Evidence library + download
│   │   │   └── api/
│   │   │       ├── compute/route.ts    # 0G Compute API (query, arbitrate, etc.)
│   │   │       └── storage/route.ts    # 0G Storage download proxy
│   │   ├── components/
│   │   │   ├── layout/Navbar.tsx       # Navigation with wallet connect
│   │   │   ├── pages/DashboardPage.tsx # Stats + quick actions
│   │   │   └── common/FileDropzone.tsx # Drag & drop file upload
│   │   └── lib/
│   │       ├── contracts.ts            # Smart contract interaction layer
│   │       ├── compute.ts              # 0G Compute broker + arbitrate()
│   │       ├── storage.ts              # 0G Storage SDK wrapper
│   │       ├── i18n.ts                 # EN/ZH translations
│   │       └── wagmi.ts                # wagmi + Reown AppKit config
│   └── package.json
└── README.md
```

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.24, Hardhat, ethers v6 |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Wallet | wagmi v2, Reown AppKit, viem |
| Storage | @0glabs/0g-ts-sdk (Merkle-verified) |
| AI Compute | @0glabs/0g-serving-broker (DeepSeek R1 70B) |
| Blockchain | 0G Galileo Testnet (Chain ID: 16602) |

## 🔗 Smart Contract

**Address**: `0xe65176BdaEBbCb9a4D12b8bAAaf95E7f3c68cd4a` (verified on ChainScan)

**Key Functions**:
| Function | Description |
|----------|-------------|
| `createEscrow(seller, amount, desc, deadline)` | Buyer creates escrow agreement |
| `fundEscrow(escrowId)` | Buyer deposits OG tokens (payable) |
| `submitEvidence(escrowId, rootHash, filename, desc)` | Either party submits evidence |
| `disputeEscrow(escrowId)` | Trigger dispute resolution |
| `castVote(escrowId, voteForBuyer)` | Arbitrators cast votes |
| `resolveEscrow(escrowId, aiVerdict, buyerWins)` | Execute final verdict + distribute funds |
| `releaseEscrow(escrowId)` | Normal release (no dispute) |
| `refundEscrow(escrowId)` | Timeout refund (deadline expired) |

[View on ChainScan](https://chainscan-galileo.0g.ai/address/0xe65176BdaEBbCb9a4D12b8bAAaf95E7f3c68cd4a)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Hardhat (for contracts)

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Contract Setup
```bash
cd contracts
npm install
npx hardhat test
npx hardhat run scripts/deploy.ts --network galileo
```

## 🏆 Hackathon

Built for the **0G APAC Hackathon** (HackQuest) — Agent Infrastructure Track.

## 📄 License

MIT
