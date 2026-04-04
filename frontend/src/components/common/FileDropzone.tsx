"use client";

import React from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File } from "lucide-react";

interface FileDropzoneProps {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
}

export default function FileDropzone({ onFileDrop, disabled = false }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    },
    accept: {
      "application/octet-stream": [],
      "application/pdf": [],
      "image/*": [],
      "text/plain": [],
      "text/markdown": [],
      "application/json": [],
      "application/xml": [],
    },
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`neon-dropzone ${
        isDragActive ? "neon-dropzone-active" : ""
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-4">
        <div
          className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center transition-colors duration-300 ${
            isDragActive
              ? "bg-neon-cyan/20 text-neon-cyan"
              : "bg-white/5 text-zinc-500"
          }`}
        >
          {isDragActive ? (
            <File className="w-8 h-8" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">
            {isDragActive ? (
              <span className="text-neon-cyan">Drop the file here</span>
            ) : (
              <>
                Drag & drop a file here, or{" "}
                <span className="text-neon-cyan">click to select</span>
              </>
            )}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            Supports PDF, images, text, JSON, XML (max 32MB)
          </p>
        </div>
      </div>
    </div>
  );
}
