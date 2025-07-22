'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCard from '@/components/VideoCard';

interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  thumbnail: string;
  duration: string;
  views: number;
  uploadDate: string;
  channelName: string;
  channelAvatar?: string;
  tags: string[];
}

const relatedVideos = [
  {
    id: '2',
    title: 'JavaScript ES6+ Features die jeder Entwickler kennen sollte',
    thumbnail: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&h=225&fit=crop',
    duration: '22:18',
    views: 87500,
    uploadDate: '2024-01-10',
    channelName: 'CodeMaster',
    channelAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: '3',
    title: 'TypeScript für Fortgeschrittene - Design Patterns und Best Practices',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop',
    duration: '18:55',
    views: 43200,
    uploadDate: '2024-01-08',
    channelName: 'DevPro',
    channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
  }
];

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string>('');

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setVideoId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  useEffect(() => {
    if (!videoId) return;
    
    const fetchVideo = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}`);
        if (!response.ok) {
          throw new Error('Video nicht gefunden');
        }
        const videoData = await response.json();
        setVideo(videoData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-white text-lg">Video wird geladen...</div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-red-400 text-lg">{error || 'Video nicht gefunden'}</div>
        </div>
      </div>
    );
  }

  const videoSrc = `http://localhost:5000/api/videos/${video.id}/stream`;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <VideoPlayer 
              src={videoSrc}
              title={video.title}
              thumbnail={video.thumbnail}
            />
            
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
              <div className="flex items-center justify-between mb-4">
                <div className="text-gray-400">
                  {formatViews(video.views)} Aufrufe • {formatDate(video.uploadDate)}
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                {video.channelAvatar ? (
                  <img
                    src={video.channelAvatar}
                    alt={video.channelName}
                    className="w-12 h-12 rounded-full mr-3"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-lg font-semibold">
                      {video.channelName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-white font-semibold">{video.channelName}</h3>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <p className="text-gray-300 leading-relaxed">{video.description}</p>
              </div>
              
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-white mb-4">Ähnliche Videos</h2>
            <div className="space-y-4">
              {relatedVideos.map((relatedVideo) => (
                <div key={relatedVideo.id} className="transform hover:scale-105 transition-transform">
                  <VideoCard {...relatedVideo} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}