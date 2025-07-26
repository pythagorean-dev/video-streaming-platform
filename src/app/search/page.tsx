'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import VideoCard from '@/components/VideoCard';
import CategoryFilter from '@/components/CategoryFilter';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  category?: string;
  tags: string[];
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
}

interface ApiResponse {
  success: boolean;
  data: {
    videos: Video[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

const categories = [
  { id: 'ALL', name: 'Alle', active: true },
  { id: 'EDUCATION', name: 'Bildung', active: false },
  { id: 'TECHNOLOGY', name: 'Technologie', active: false },
  { id: 'ENTERTAINMENT', name: 'Unterhaltung', active: false },
  { id: 'MUSIC', name: 'Musik', active: false },
  { id: 'GAMING', name: 'Gaming', active: false },
  { id: 'NEWS', name: 'Nachrichten', active: false },
  { id: 'SPORTS', name: 'Sport', active: false },
  { id: 'LIFESTYLE', name: 'Lifestyle', active: false },
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const searchVideos = async (searchQuery: string, category: string = 'ALL', pageNum: number = 1, append: boolean = false) => {
    try {
      setLoading(!append);
      setError(null);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '12',
        sortBy: 'relevance',
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      if (category !== 'ALL') {
        params.append('category', category);
      }

      const response = await fetch(`/api/videos?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to search videos');
      }

      const data: ApiResponse = await response.json();

      if (append) {
        setVideos(prev => [...prev, ...data.data.videos]);
      } else {
        setVideos(data.data.videos);
      }
      
      setHasNextPage(data.data.pagination.hasNextPage);
      setPage(pageNum);

    } catch (err) {
      console.error('Error searching videos:', err);
      setError('Fehler beim Suchen der Videos. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchVideos(query, selectedCategory, 1, false);
  }, [query, selectedCategory]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setPage(1);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !loading) {
      searchVideos(query, selectedCategory, page + 1, true);
    }
  };

  const formatDuration = (duration: number | undefined) => {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'vor 1 Tag';
    if (diffDays < 30) return `vor ${diffDays} Tagen`;
    if (diffDays < 365) return `vor ${Math.floor(diffDays / 30)} Monaten`;
    return `vor ${Math.floor(diffDays / 365)} Jahren`;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Results Header */}
        <div className="py-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Suchergebnisse für "{query}"
          </h1>
          <p className="text-gray-400">
            {loading ? 'Suche läuft...' : `${videos.length} Videos gefunden`}
          </p>
        </div>

        {/* Category Filter */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />

        {/* Content Area */}
        <div className="pb-8">
          {loading && videos.length === 0 ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-red-400 text-lg mb-2">⚠️ Fehler</div>
                <p className="text-gray-400">{error}</p>
                <button
                  onClick={() => searchVideos(query, selectedCategory, 1, false)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-gray-400 text-lg mb-2">🔍</div>
                <p className="text-gray-400">
                  Keine Videos für "{query}" gefunden
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Versuchen Sie andere Suchbegriffe oder wählen Sie eine andere Kategorie
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Video Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    id={video.id}
                    title={video.title}
                    thumbnail={video.thumbnailUrl || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1280&h=720&fit=crop'}
                    duration={formatDuration(video.duration)}
                    views={video.viewCount}
                    uploadDate={formatDate(video.publishedAt)}
                    channelName={video.author.displayName}
                    channelAvatar={video.author.avatar}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Lädt...</span>
                      </>
                    ) : (
                      <span>Mehr Videos laden</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}