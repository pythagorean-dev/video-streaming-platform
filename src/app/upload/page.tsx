'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { CloudArrowUpIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [channelName, setChannelName] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
      } else {
        alert('Bitte wählen Sie eine Videodatei aus.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.startsWith('video/')) {
        setFile(selectedFile);
      } else {
        alert('Bitte wählen Sie eine Videodatei aus.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title || !description) {
      alert('Bitte füllen Sie alle Pflichtfelder aus und wählen Sie eine Videodatei.');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('channelName', channelName || 'Anonymous');
    formData.append('tags', tags);

    try {
      const response = await fetch('http://localhost:5000/api/videos/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert('Video erfolgreich hochgeladen!');
        router.push('/');
      } else {
        const error = await response.json();
        alert(`Fehler beim Hochladen: ${error.error}`);
      }
    } catch (error) {
      alert('Fehler beim Hochladen des Videos. Bitte versuchen Sie es später erneut.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <VideoCameraIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Video hochladen</h1>
            <p className="text-gray-400">Teilen Sie Ihr Video mit der Welt</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-4">
                  <VideoCameraIcon className="h-16 w-16 text-green-500 mx-auto" />
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Datei entfernen
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-white mb-2">
                      Ziehen Sie Ihr Video hierher oder klicken Sie zum Auswählen
                    </p>
                    <p className="text-gray-400 text-sm">
                      Unterstützte Formate: MP4, AVI, MOV, WMV, FLV, WebM, MKV (max. 500MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer inline-block transition-colors"
                  >
                    Datei auswählen
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-white font-medium mb-2">
                  Titel *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Geben Sie einen aussagekräftigen Titel ein"
                  required
                />
              </div>

              <div>
                <label htmlFor="channelName" className="block text-white font-medium mb-2">
                  Kanal Name
                </label>
                <input
                  type="text"
                  id="channelName"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ihr Kanal Name (optional)"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-white font-medium mb-2">
                Beschreibung *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Beschreiben Sie Ihr Video..."
                required
              />
            </div>

            <div>
              <label htmlFor="tags" className="block text-white font-medium mb-2">
                Tags
              </label>
              <input
                type="text"
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tags durch Komma getrennt (z.B. tutorial, javascript, react)"
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={uploading || !file || !title || !description}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {uploading ? 'Wird hochgeladen...' : 'Video hochladen'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}