import React, { useState, useEffect } from 'react';
import { useNetwork } from '@/app/providers';
import { useWallet } from '@/hooks/useWallet';
import { useFees } from '@/hooks/useFees';
import { useUpload } from '@/hooks/useUpload';
import { FileDropzone } from '@/components/common/FileDropzone';
import { FileInfo } from '@/components/common/FileInfo';
import { FeeDisplay } from '@/components/common/FeeDisplay';
import { TransactionStatus } from '@/components/common/TransactionStatus';

interface FileInfo {
  name: string;
  size: number;
  blob?: any;
}

/**
 * A component that allows users to upload files to 0G Storage
 * Uses reusable components and custom hooks for a modular design
 */
export function UploadCard() {
  // Network and wallet state management
  const { networkType } = useNetwork();
  const { address, isConnected } = useWallet();
  
  // File state
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  
  // Custom hooks
  const { 
    feeInfo, 
    error: feeError, 
    rootHash, 
    submission, 
    flowContract, 
    calculateFeesForFile, 
    getCurrentNetwork,
    blob
  } = useFees();
  
  const {
    loading: uploadLoading,
    error: uploadError,
    uploadStatus,
    txHash,
    uploadFile,
    resetUploadState,
    getExplorerUrl
  } = useUpload();
  
  // Create a key for forcing component remount on network change
  const networkKey = networkType;
  
  // Handle file drop
  const handleFileDrop = (file: File) => {
    // Reset transaction state when a new file is selected
    if (txHash) {
      console.log('Resetting upload state - txHash exists:', txHash);
      resetUploadState();
    }
    
    // Set the new file info
    setFileInfo({
      name: file.name,
      size: file.size
    });
    
    // Calculate fees for the file if wallet is connected
    calculateFeesForFile(file, isConnected);
  };
  
  // Handle clear file selection
  const handleClearFile = () => {
    setFileInfo(null);
    resetUploadState();
  };
  
  // Handle retry fee calculation
  const handleRetryFeeCalculation = () => {
    if (fileInfo) {
      const input = document.createElement('input');
      input.type = 'file';
      
      input.onchange = (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          handleFileDrop(files[0]);
        }
      };
      
      input.click();
    }
  };
  
  // Handle upload click
  const handleUpload = async () => {
    if (!blob || !submission || !flowContract || !feeInfo) return;
    
    // Upload the file and get the transaction hash
    await uploadFile(blob, submission, flowContract, feeInfo.rawTotalFee);
  };
  
  // Reset state when network changes
  useEffect(() => {
    setFileInfo(null);
  }, [networkType]);
  
  return (
    <div key={networkKey} className="bg-white rounded-2xl shadow-lg p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Upload to 0G Storage</h2>
        <div className={`text-xs font-semibold px-3 py-1 rounded-full ${
          networkType === 'standard' 
            ? 'bg-[#FFDCD4] text-gray-800' 
            : 'bg-[#CAF0FC] text-gray-800'
        }`}>
          {getCurrentNetwork().name} Mode
        </div>
      </div>
      
      {/* Show the file dropzone if no file selected */}
      {!fileInfo && (
        <FileDropzone onFileDrop={handleFileDrop} disabled={uploadLoading} />
      )}
      
      {/* Show file info if a file is selected */}
      {fileInfo && (
        <FileInfo 
          fileInfo={fileInfo} 
          rootHash={rootHash} 
          onClear={handleClearFile}
        />
      )}
      
      {/* Show select new file button if upload is complete */}
      {fileInfo && txHash && (
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files && files.length > 0) {
                handleFileDrop(files[0]);
              }
            };
            input.click();
          }}
          className="mt-3 w-full py-2 px-4 rounded-lg font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Select Another File
        </button>
      )}
      
      {/* Show fee information if a file is selected and not yet uploaded */}
      {fileInfo && !txHash && (
        <FeeDisplay 
          feeInfo={feeInfo} 
          error={feeError} 
          onRetry={handleRetryFeeCalculation} 
        />
      )}
      
      {/* Upload Button */}
      {fileInfo && !txHash && !uploadLoading && (
        <button
          onClick={handleUpload}
          disabled={!isConnected || feeInfo.isLoading || !submission || uploadLoading}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white flex items-center justify-center
            ${(!isConnected || feeInfo.isLoading || !submission || uploadLoading)
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          Upload
        </button>
      )}
      
      {/* Upload Status and Transaction Hash */}
      <TransactionStatus 
        uploadStatus={uploadStatus} 
        txHash={txHash} 
        explorerUrl={getCurrentNetwork().explorerUrl} 
      />
      
      {/* Display upload errors */}
      {uploadError && !uploadStatus && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md">
          <p className="text-xs text-red-600">{uploadError}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Export a container component that ensures remounting when network changes
 */
export default function UploadCardContainer() {
  const { networkType } = useNetwork();
  
  return (
    <div key={networkType}>
      <UploadCard />
    </div>
  );
} 