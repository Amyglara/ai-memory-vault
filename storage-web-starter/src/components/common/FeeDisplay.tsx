import React from 'react';
import { FeeInfo } from '@/lib/0g/fees';

interface FeeDisplayProps {
  feeInfo: FeeInfo;
  error: string;
  onRetry?: () => void;
}

/**
 * A component for displaying fee information for a file upload
 */
export function FeeDisplay({ feeInfo, error, onRetry }: FeeDisplayProps) {
  return (
    <div className="mt-5 pt-3 border-t border-gray-100">
      <h4 className="font-medium text-gray-900 text-md mb-2 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1 text-blue-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Fee Information
      </h4>
      
      {feeInfo.isLoading ? (
        <div className="flex items-center space-x-2 py-3 px-4 bg-gray-50 rounded-md">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-sm text-gray-600">Calculating fees...</p>
        </div>
      ) : (
        <div className="rounded-md bg-gray-50 p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Storage Fee:</span>
            <span className="font-medium text-gray-800">{feeInfo.storageFee} A0GI</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estimated Gas:</span>
            <span className="font-medium text-gray-800">{feeInfo.estimatedGas} A0GI</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-medium">Total Fee:</span>
            <span className="font-bold text-blue-700">{feeInfo.totalFee} A0GI</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-md">
          <p className="text-xs text-red-600">{error}</p>
          {onRetry && (error.includes('wallet') || error.includes('provider') || error.includes('calculate fees')) && (
            <button 
              onClick={onRetry}
              className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-xs rounded-md hover:bg-red-200 transition-colors"
            >
              Retry Fee Calculation
            </button>
          )}
        </div>
      )}
    </div>
  );
} 