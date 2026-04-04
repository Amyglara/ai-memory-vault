# 0G Storage Web App Starter Kit

A modular, well-structured starter kit for building applications that interact with 0G Storage. This project provides a clean architecture for uploading and downloading files using the 0G Storage protocol.

## Features

- File upload to 0G Storage with fee calculation
- File download from 0G Storage using root hash
- Support for both Standard and Turbo network modes
- Wallet integration with connection management
- Modern React UI components with TailwindCSS

## Getting Started

### Prerequisites

- Node.js (v16+)
- Ethereum wallet (e.g., MetaMask)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/0g-storage-starter-kit.git
   cd 0g-storage-starter-kit
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables by creating a `.env.local` file (see Environment Variables section below)

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

The project is organized into a clean, modular architecture:

```
src/
├── app/                   # Next.js app router components
│   ├── providers.tsx      # App providers (Wagmi, Network context)
│   ├── page.tsx           # Main application page
│
├── components/            # React components
│   ├── common/            # Reusable UI components
│   │   ├── FileDropzone.tsx     # Drag-and-drop file selector
│   │   ├── FileInfo.tsx         # File information display
│   │   ├── FeeDisplay.tsx       # Fee calculation display
│   │   ├── TransactionStatus.tsx # Transaction status display
│   │
│   ├── upload/            # Upload-specific components
│   │   ├── UploadCard.tsx    # File upload card
│   │   ├── UploadCardContainer.tsx # Container with remounting logic
│   │
│   ├── download/          # Download-specific components
│   │   ├── DownloadCard.tsx  # File download card
│   │   ├── DownloadCardContainer.tsx # Container with remounting logic
│   │
│   ├── ConnectButton.tsx  # Wallet connection button
│   ├── NetworkToggle.tsx  # Network mode toggle
│
├── hooks/                 # Custom React hooks
│   ├── useWallet.ts       # Wallet connection management
│   ├── useFees.ts         # Fee calculation logic
│   ├── useUpload.ts       # File upload logic
│   ├── useDownload.ts     # File download logic
│
├── lib/                   # Core utilities and SDK
│   ├── 0g/                # 0G Storage SDK utilities
│   │   ├── blob.ts        # Blob creation and handling
│   │   ├── fees.ts        # Fee calculation utilities
│   │   ├── network.ts     # Network configuration
│   │   ├── uploader.ts    # File upload utilities
│   │   ├── downloader.ts  # File download utilities
│
├── utils/                 # Helper functions
│   ├── format.ts          # Formatting utilities
```

## Architecture Overview

This starter kit follows a layered architecture:

### 1. Core SDK/API Layer (`lib/0g/`)

Low-level utilities for interacting with the 0G Storage protocol:

- **blob.ts**: Functions for creating blobs, generating Merkle trees, and root hash calculation
- **fees.ts**: Functions for calculating storage fees and gas estimates
- **network.ts**: Network configuration and management
- **uploader.ts**: Functions for submitting transactions and uploading files
- **downloader.ts**: Functions for downloading files by root hash

### 2. React Hooks Layer (`hooks/`)

Custom hooks that abstract the core functionalities:

- **useWallet.ts**: Manages wallet connection and status, handling hydration safely
- **useFees.ts**: Provides fee calculation for file uploads, creating blobs and Merkle trees
- **useUpload.ts**: Handles the file upload process including transaction submission
- **useDownload.ts**: Manages file downloading by root hash, including error handling

### 3. UI Components Layer (`components/`)

React components for the user interface:

- **Common components**: Reusable UI elements like `FileDropzone`, `FileInfo`, etc.
- **Feature components**: Higher-level components like `UploadCard` and `DownloadCard`

## Usage Examples

### Fee Estimation

To calculate fees for uploading a file:

```jsx
import { useFees } from '@/hooks/useFees';
import { useWallet } from '@/hooks/useWallet';

function MyComponent() {
  const { isConnected } = useWallet();
  const { calculateFeesForFile, feeInfo, error } = useFees();
  
  // When a file is selected
  const handleFileSelect = (file) => {
    // Calculate fees for the file if wallet is connected
    calculateFeesForFile(file, isConnected);
  };
  
  return (
    <div>
      {/* Display fee information */}
      {feeInfo && (
        <div>
          <p>Storage Fee: {feeInfo.storageFee} A0GI</p>
          <p>Estimated Gas: {feeInfo.estimatedGas} A0GI</p>
          <p>Total Fee: {feeInfo.totalFee} A0GI</p>
        </div>
      )}
      
      {/* Display any errors */}
      {error && <p>{error}</p>}
    </div>
  );
}
```

### File Upload

To upload a file to 0G Storage:

```jsx
import { useFees } from '@/hooks/useFees';
import { useUpload } from '@/hooks/useUpload';

function MyUploadComponent() {
  // Get fee calculation hooks
  const { 
    blob, 
    submission, 
    flowContract, 
    feeInfo
  } = useFees();
  
  // Get upload hooks
  const { 
    uploadFile, 
    loading, 
    uploadStatus, 
    txHash, 
    error 
  } = useUpload();
  
  // Handle upload button click
  const handleUpload = async () => {
    if (!blob || !submission || !flowContract || !feeInfo) {
      return; // Missing required data
    }
    
    // Upload the file using the calculated fee
    await uploadFile(
      blob, 
      submission, 
      flowContract, 
      feeInfo.rawTotalFee
    );
  };
  
  return (
    <div>
      <button 
        onClick={handleUpload}
        disabled={loading || !submission}
      >
        Upload File
      </button>
      
      {/* Display upload status */}
      {uploadStatus && <p>{uploadStatus}</p>}
      
      {/* Display transaction hash if available */}
      {txHash && <p>Transaction: {txHash}</p>}
      
      {/* Display any errors */}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### File Download

To download a file from 0G Storage using a root hash:

```jsx
import { useDownload } from '@/hooks/useDownload';

function MyDownloadComponent() {
  const { 
    downloadFile, 
    loading, 
    downloadStatus, 
    error 
  } = useDownload();
  
  // Handle download action
  const handleDownload = async (rootHash, fileName) => {
    await downloadFile(rootHash, fileName);
  };
  
  return (
    <div>
      <button 
        onClick={() => handleDownload('0x1234...', 'my-file.pdf')}
        disabled={loading}
      >
        Download File
      </button>
      
      {/* Display download status */}
      {downloadStatus && <p>{downloadStatus}</p>}
      
      {/* Display any errors */}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Project ID for WalletConnect (required)
NEXT_PUBLIC_PROJECT_ID=your_project_id_here

# L1 RPC URL
NEXT_PUBLIC_L1_RPC=https://evmrpc-testnet.0g.ai

# Standard network
NEXT_PUBLIC_STANDARD_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_STANDARD_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_STANDARD_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_STANDARD_L1_RPC=https://evmrpc-testnet.0g.ai

# Turbo network
NEXT_PUBLIC_TURBO_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_TURBO_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_TURBO_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_TURBO_L1_RPC=https://evmrpc-testnet.0g.ai

# Default network
NEXT_PUBLIC_DEFAULT_NETWORK=turbo
```

## Advanced Usage

### Working with Network Modes

The application supports two network modes: Standard and Turbo. You can access and change the network mode using the `useNetwork` hook:

```jsx
import { useNetwork } from '@/app/providers';
import { getNetworkConfig } from '@/lib/0g/network';

function MyNetworkComponent() {
  const { networkType, setNetworkType } = useNetwork();
  const networkConfig = getNetworkConfig(networkType);
  
  return (
    <div>
      <p>Current Network: {networkType}</p>
      <p>Flow Address: {networkConfig.flowAddress}</p>
      <button onClick={() => setNetworkType(networkType === 'standard' ? 'turbo' : 'standard')}>
        Toggle Network
      </button>
    </div>
  );
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
