import React, { useState } from 'react';
import { formatFileSize, truncateString } from '@/utils/format';

interface FileInfoProps {
  fileInfo: {
    name: string;
    size: number;
  };
  rootHash?: string;
  onClear?: () => void;
}

/**
 * A component for displaying file information and root hash
 */
export function FileInfo({ fileInfo, rootHash, onClear }: FileInfoProps) {
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

  return (
    <div className="mt-6 p-5 bg-white rounded-lg shadow-sm border border-gray-100 relative">
      {/* Clear button */}
      {onClear && (
        <button 
          onClick={onClear}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear file selection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      <h3 className="font-medium text-gray-900 text-lg mb-3 pb-2 border-b">Selected File</h3>
      <div className="mt-3 text-sm text-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">Name:</span>
          <span className="text-gray-800 max-w-[15rem] truncate" title={fileInfo.name}>
            {fileInfo.name || 'Unknown'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">Size:</span>
          <span className="text-gray-800">{formatFileSize(fileInfo.size)}</span>
        </div>
        
        {rootHash && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <p className="font-medium text-gray-900">Root Hash:</p>
              <button 
                onClick={() => copyToClipboard(rootHash)}
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="relative">
              <p className="break-all font-mono text-xs bg-gray-50 p-2 rounded-md text-gray-700 overflow-x-auto">
                {truncateString(rootHash, 12, 12)}
              </p>
              {copySuccess && (
                <span className="absolute top-0 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-md">
                  Copied!
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 