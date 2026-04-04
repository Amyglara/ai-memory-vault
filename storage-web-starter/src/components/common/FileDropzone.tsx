import React from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
}

/**
 * A reusable drag-and-drop zone component for file selection
 */
export function FileDropzone({ onFileDrop, disabled = false }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    },
    accept: {
      'application/octet-stream': [],
      'application/pdf': [],
      'image/*': [],
      'text/plain': [],
      'application/json': [],
      'application/xml': [],
    },
    maxFiles: 1,
    multiple: false,
    disabled
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors shadow-sm
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-blue-400 bg-white'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-4">
        <div className="text-5xl text-blue-500 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium">
          {isDragActive
            ? 'Drop the file here'
            : 'Drag & drop a file here, or click to select'}
        </p>
        <p className="text-gray-500 text-sm">
          We'll calculate storage fees once you select a file
        </p>
      </div>
    </div>
  );
} 