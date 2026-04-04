import React, { useState } from 'react';
import { useNetwork } from '@/app/providers';
import { useWallet } from '@/hooks/useWallet';
import { useDownload } from '@/hooks/useDownload';

/**
 * A component that allows users to download files from 0G Storage using root hash
 * Uses custom hooks for a modular design
 */
export function DownloadCard() {
  // Network and wallet state management
  const { networkType } = useNetwork();
  const { address, isConnected } = useWallet();
  
  // Local state
  const [rootHash, setRootHash] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  
  // Download hook
  const {
    loading: downloadLoading,
    error: downloadError,
    downloadStatus,
    downloadFile
  } = useDownload();
  
  // Handle download form submission
  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate rootHash
    if (!rootHash) {
      alert('Please enter a root hash');
      return;
    }
    
    // Basic format validation
    if (!rootHash.startsWith('0x') || rootHash.length !== 66) {
      alert('Invalid root hash format. Root hash should be a 0x-prefixed 64-character hex string');
      return;
    }
    
    // Validate that the hash contains only valid hex characters
    const hexRegex = /^0x[0-9a-fA-F]{64}$/;
    if (!hexRegex.test(rootHash)) {
      alert('Invalid root hash format. Root hash should contain only hexadecimal characters (0-9, a-f)');
      return;
    }
    
    // Download the file with optional custom filename
    await downloadFile(rootHash, customFileName || undefined);
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Download from 0G Storage</h2>
        <div className={`text-xs font-semibold px-3 py-1 rounded-full ${
          networkType === 'standard' 
            ? 'bg-[#FFDCD4] text-gray-800' 
            : 'bg-[#CAF0FC] text-gray-800'
        }`}>
          {networkType.charAt(0).toUpperCase() + networkType.slice(1)} Mode
        </div>
      </div>
      
      {/* Download Form */}
      <form onSubmit={handleDownload} className="mt-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="rootHash" className="block text-sm font-medium text-gray-700 mb-1">
              Root Hash
            </label>
            <input
              id="rootHash"
              type="text"
              value={rootHash}
              onChange={(e) => setRootHash(e.target.value)}
              placeholder="Enter the root hash of the file"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              required
            />
          </div>
          
          <div>
            <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 mb-1">
              Custom File Name (Optional)
            </label>
            <input
              id="fileName"
              type="text"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              placeholder="Enter a custom file name (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          
          <button
            type="submit"
            disabled={!rootHash || downloadLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white flex items-center justify-center
              ${(!rootHash || downloadLoading)
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </button>
        </div>
      </form>
      
      {/* Download Status */}
      {downloadStatus && (
        <div className={`mt-4 p-3 rounded-md ${
          downloadStatus.includes('complete')
            ? 'bg-green-50 text-green-700 border border-green-100' 
            : 'bg-blue-50 text-blue-700 border border-blue-100'
        }`}>
          <div className="flex items-center">
            {downloadStatus.includes('complete') ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : (
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
            )}
            <p className="text-sm">{downloadStatus}</p>
          </div>
        </div>
      )}
      
      {/* Download Error - Enhanced for better user experience */}
      {downloadError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-md overflow-hidden">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="w-full overflow-hidden">
              <h4 className="text-sm font-medium text-red-800 mb-1">Download Failed</h4>
              <p className="text-xs text-red-600 break-words whitespace-normal overflow-hidden">{downloadError}</p>
              
              {/* Display helpful suggestions based on the error message */}
              {downloadError.includes('File not found') && (
                <div className="mt-2 text-xs text-gray-600 border-t border-red-100 pt-2">
                  <p className="font-medium mb-1">Suggestions:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>Double-check that you entered the correct root hash</li>
                    <li>Verify that the file was successfully uploaded to 0G Storage</li>
                    <li>Confirm you're using the correct network mode (Standard/Turbo)</li>
                    <li>Try again after a few minutes as the file might still be propagating</li>
                  </ul>
                </div>
              )}
              
              {/* Display generic suggestions for other errors */}
              {!downloadError.includes('File not found') && (
                <div className="mt-2 text-xs text-gray-600 border-t border-red-100 pt-2">
                  <p className="font-medium mb-1">Suggestions:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>Check your internet connection</li>
                    <li>Try switching network modes</li>
                    <li>Refresh the page and try again</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Export a container component that ensures consistency with network changes
 */
export default function DownloadCardContainer() {
  const { networkType } = useNetwork();
  
  return (
    <div key={networkType}>
      <DownloadCard />
    </div>
  );
} 