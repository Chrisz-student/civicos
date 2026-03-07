// ============================================
// FileDropZone — Drag & drop or click to upload
// Accepts jpg/png, max 10MB
// ============================================

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
}

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

export default function FileDropZone({ onFileSelected }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = (file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPG and PNG images are accepted.');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }

    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
    onFileSelected(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSet(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Photo (optional — jpg or png, max 10MB)
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full py-8 px-6 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : preview
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400'
        }`}
      >
        {preview ? (
          <div className="space-y-2">
            <img
              src={preview}
              alt="Preview"
              className="max-h-32 mx-auto rounded"
            />
            <p className="text-sm text-green-700">✅ {fileName}</p>
          </div>
        ) : (
          <p className="text-gray-500">
            📷 Drag & drop an image here, or click to browse
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
