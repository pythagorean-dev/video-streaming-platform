'use client';

import { useState, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

interface ChunkedUploadProps {
  onUploadComplete: (videoId: string) => void;
  onProgress: (progress: number) => void;
  onError: (error: string) => void;
  videoId: string;
  userId: string;
  maxFileSize?: number;
  chunkSize?: number;
}

interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
}

export default function ChunkedUpload({
  onUploadComplete,
  onProgress,
  onError,
  videoId,
  userId,
  maxFileSize = 10 * 1024 * 1024 * 1024, // 10GB
  chunkSize = 5 * 1024 * 1024 // 5MB chunks
}: ChunkedUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    uploaded: 0,
    total: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0
  });
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadedChunks, setUploadedChunks] = useState<number[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Unsupported file type. Please upload MP4, MOV, AVI, WebM, or MKV files.';
    }
    
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
    }
    
    if (file.size < 1024) {
      return 'File too small. Minimum size is 1KB.';
    }
    
    return null;
  };
  
  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  const formatTime = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds)) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  const initializeUpload = async (file: File): Promise<string> => {
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    const response = await fetch('/api/v1/upload/chunked/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
        totalChunks,
        videoId,
        userId
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to initialize upload');
    }
    
    const data = await response.json();
    return data.data.uploadId;
  };
  
  const uploadChunk = async (
    uploadId: string,
    chunk: Blob,
    chunkIndex: number,
    signal: AbortSignal
  ): Promise<void> => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    
    const response = await fetch(`/api/v1/upload/chunked/upload/${uploadId}`, {
      method: 'POST',
      body: formData,
      signal
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to upload chunk ${chunkIndex}`);
    }
  };
  
  const completeUpload = async (uploadId: string, file: File): Promise<void> => {
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    const response = await fetch(`/api/v1/upload/chunked/complete/${uploadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId,
        userId,
        filename: file.name,
        totalChunks
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to complete upload');
    }
  };
  
  const updateProgress = useCallback((uploaded: number, total: number) => {
    const percentage = Math.round((uploaded / total) * 100);
    const currentTime = Date.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    const speed = uploaded / elapsed;
    const remaining = (total - uploaded) / speed;
    
    const progressData = {
      uploaded,
      total,
      percentage,
      speed,
      timeRemaining: remaining
    };
    
    setProgress(progressData);
    onProgress(percentage);
  }, [onProgress]);
  
  const startUpload = async () => {
    if (!file) return;
    
    try {
      setUploading(true);
      setPaused(false);
      startTimeRef.current = Date.now();
      
      // Initialize upload
      const uploadId = await initializeUpload(file);
      setUploadId(uploadId);
      
      // Check for existing chunks
      const progressResponse = await fetch(`/api/v1/upload/progress/${uploadId}`);
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setUploadedChunks(progressData.data.uploadedChunks || []);
      }
      
      const totalChunks = Math.ceil(file.size / chunkSize);
      abortControllerRef.current = new AbortController();
      
      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (paused) {
          await new Promise(resolve => {
            const checkPause = () => {
              if (!paused) {
                resolve(void 0);
              } else {
                setTimeout(checkPause, 100);
              }
            };
            checkPause();
          });
        }
        
        // Skip already uploaded chunks
        if (uploadedChunks.includes(chunkIndex)) {
          const uploadedBytes = (chunkIndex + 1) * chunkSize;
          updateProgress(Math.min(uploadedBytes, file.size), file.size);
          continue;
        }
        
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        await uploadChunk(uploadId, chunk, chunkIndex, abortControllerRef.current.signal);
        
        setUploadedChunks(prev => [...prev, chunkIndex]);
        const uploadedBytes = (chunkIndex + 1) * chunkSize;
        updateProgress(Math.min(uploadedBytes, file.size), file.size);
      }
      
      // Complete upload
      await completeUpload(uploadId, file);
      
      setUploading(false);
      onUploadComplete(videoId);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Upload was cancelled
        return;
      }
      
      console.error('Upload error:', error);
      setUploading(false);
      onError(error.message || 'Upload failed');
    }
  };
  
  const pauseUpload = () => {
    setPaused(true);
  };
  
  const resumeUpload = () => {
    setPaused(false);
  };
  
  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setPaused(false);
    setProgress({
      uploaded: 0,
      total: 0,
      percentage: 0,
      speed: 0,
      timeRemaining: 0
    });
    setUploadedChunks([]);
    setUploadId(null);
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    const validationError = validateFile(selectedFile);
    if (validationError) {
      onError(validationError);
      return;
    }
    
    setFile(selectedFile);
  };
  
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-lg p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {!file ? (
        <div
          onClick={triggerFileSelect}
          className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="text-4xl mb-4">📹</div>
          <h3 className="text-lg font-medium text-white mb-2">
            Select Video File
          </h3>
          <p className="text-gray-400 mb-4">
            Click to browse or drag and drop your video file here
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: MP4, MOV, AVI, WebM, MKV<br />
            Maximum size: {formatFileSize(maxFileSize)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-white truncate">
                {file.name}
              </h3>
              <p className="text-sm text-gray-400">
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={triggerFileSelect}
              className="ml-4 text-blue-500 hover:text-blue-400 text-sm"
            >
              Change File
            </button>
          </div>
          
          {uploading && (
            <div className="space-y-3">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm text-gray-400">
                <span>{progress.percentage}%</span>
                <span>
                  {formatFileSize(progress.uploaded)} / {formatFileSize(progress.total)}
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-gray-400">
                <span>Speed: {formatFileSize(progress.speed)}/s</span>
                <span>ETA: {formatTime(progress.timeRemaining)}</span>
              </div>
              
              <div className="flex space-x-2">
                {!paused ? (
                  <button
                    onClick={pauseUpload}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeUpload}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={cancelUpload}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {!uploading && (
            <button
              onClick={startUpload}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Start Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}