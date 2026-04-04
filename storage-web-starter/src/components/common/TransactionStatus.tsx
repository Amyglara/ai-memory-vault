import React, { useState } from 'react';

interface TransactionStatusProps {
  uploadStatus: string;
  txHash: string;
  explorerUrl?: string;
}

/**
 * A component for displaying transaction status and hash information
 */
export function TransactionStatus({ uploadStatus, txHash, explorerUrl }: TransactionStatusProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      // Error handling for clipboard operations
    }
  };

  if (!uploadStatus) {
    return null;
  }

  const isCompleted = uploadStatus.includes('complete');

  return (
    <div className="mt-4">
      {/* Upload Status */}
      <div className={`p-3 text-sm rounded-md ${
        isCompleted 
          ? 'bg-green-50 text-green-700 border border-green-100' 
          : 'bg-blue-50 text-blue-700 border border-blue-100'
      }`}>
        <div className="flex items-center">
          {isCompleted ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
          )}
          <p>{uploadStatus}</p>
        </div>
      </div>
      
      {/* Transaction Hash Section */}
      {txHash && (
        <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-green-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              Transaction Confirmed!
            </h4>
          </div>
          
          <div className="relative mb-3">
            <p className="break-all font-mono text-xs bg-white p-2 rounded-md text-gray-700 overflow-x-auto border border-green-200">
              {txHash}
            </p>
            {copySuccess && (
              <span className="absolute top-0 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-md">
                Copied!
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={() => copyToClipboard(txHash)}
              className="flex-1 flex justify-center items-center px-3 py-2 bg-green-100 text-green-700 text-xs rounded-md hover:bg-green-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
              </svg>
              Copy Transaction Hash
            </button>
            
            {explorerUrl && (
              <a 
                href={explorerUrl + txHash}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex justify-center items-center px-3 py-2 bg-blue-100 text-blue-700 text-xs rounded-md hover:bg-blue-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                View on Explorer
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 