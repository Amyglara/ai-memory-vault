import React, { useState } from 'react';
import { useNetwork } from '@/app/providers';

export default function NetworkToggle() {
  const { networkType, setNetworkType } = useNetwork();
  const [showTooltip, setShowTooltip] = useState(false);

  const toggleNetwork = () => {
    setNetworkType(prev => prev === 'standard' ? 'turbo' : 'standard');
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={toggleNetwork}
        className="relative inline-flex items-center w-[240px] h-[48px] rounded-full 
                  shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300 
                  transition-all duration-300"
        style={{ 
          backgroundColor: networkType === 'standard' ? '#FFDCD4' : '#CAF0FC',
        }}
        aria-pressed={networkType === 'turbo'}
        aria-labelledby="network-toggle"
      >
        {/* Sliding indicator */}
        <span 
          className="absolute top-2 bottom-2 bg-white rounded-full shadow-sm transition-all duration-300"
          style={{ 
            left: networkType === 'standard' ? '4px' : '124px',
            width: '112px',
          }}
        />
        
        {/* Standard Network Option */}
        <div className={`flex items-center justify-center w-1/2 z-10 transition-colors duration-300 ${
          networkType === 'standard' ? 'text-gray-800' : 'text-gray-500'
        }`}>
          <span className="text-lg mr-3" role="img" aria-label="tortoise">🐢</span>
          <span className="text-sm font-medium">Standard</span>
        </div>
        
        {/* Turbo Network Option */}
        <div className={`flex items-center justify-center w-1/2 z-10 transition-colors duration-300 ${
          networkType === 'turbo' ? 'text-gray-800' : 'text-gray-500'
        }`}>
          <span className="text-sm font-medium">Turbo</span>
          <span className="text-lg ml-3" role="img" aria-label="rabbit">🐇</span>
        </div>
      </button>

      {/* Info icon with tooltip */}
      <div 
        className="ml-2 relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <button
          className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Network mode information"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-20 right-0 translate-y-2 w-60 p-3 bg-white shadow-lg rounded-lg border border-gray-100 text-sm animate-fade-in">
            <div className="absolute -top-2 right-2 w-4 h-4 bg-white border-t border-l border-gray-100 transform rotate-45"></div>
            <div className="relative z-10">
              <div className="mb-2 pb-2 border-b border-gray-100">
                <div className="flex items-center mb-1">
                  <span className="text-base mr-2" role="img" aria-label="tortoise">🐢</span>
                  <span className="font-semibold text-gray-800">Standard</span>
                </div>
                <p className="text-gray-600 text-xs">Low cost, normal speed processing. Best for most uploads where time isn't critical.</p>
              </div>
              
              <div>
                <div className="flex items-center mb-1">
                  <span className="text-base mr-2" role="img" aria-label="rabbit">🐇</span>
                  <span className="font-semibold text-gray-800">Turbo</span>
                </div>
                <p className="text-gray-600 text-xs">High speed but higher cost. Ideal for time-sensitive uploads that need priority processing.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 