'use client';

import { useState, useEffect } from 'react';
import { ChunkedUpload } from '../ChunkedUpload';

interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt?: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'PRIVATE';
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | 'SCHEDULED';
  category?: string;
  tags: string[];
  monetizationEnabled: boolean;
}

interface VideoManagerProps {
  userId?: string;
}

export function VideoManager({ userId }: VideoManagerProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    if (userId) {
      fetchVideos();
    }
  }, [userId, filter, sortBy]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filter,
        sortBy,
        limit: '50'
      });
      
      const response = await fetch(`/api/users/${userId}/videos?${params}`);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (videoId: string) => {
    setShowUpload(false);
    fetchVideos(); // Refresh video list
  };

  const handleUploadProgress = (progress: number) => {
    // Handle upload progress if needed
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Show error message to user
  };

  const handleVideoEdit = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleVideoDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setVideos(videos.filter(v => v.id !== videoId));
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const handleVideoUpdate = async (videoId: string, updates: Partial<Video>) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedVideo = await response.json();
        setVideos(videos.map(v => v.id === videoId ? updatedVideo.data : v));
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error('Error updating video:', error);
    }
  };

  const formatDuration = (duration: number | undefined) => {
    if (!duration) return 'Processing...';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const getStatusColor = (status: Video['status']) => {
    switch (status) {
      case 'READY': return 'text-green-500';
      case 'PROCESSING': return 'text-yellow-500';
      case 'UPLOADING': return 'text-blue-500';
      case 'FAILED': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getVisibilityIcon = (visibility: Video['visibility']) => {
    switch (visibility) {
      case 'PUBLIC':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
      case 'UNLISTED':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        );
      case 'PRIVATE':
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        );
      case 'SCHEDULED':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
            <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
        );
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Video Manager</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          Upload Video
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-gray-300 text-sm">Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-1 text-sm"
            >
              <option value="all">All Videos</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-gray-300 text-sm">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-1 text-sm"
            >
              <option value="date">Upload Date</option>
              <option value="views">Views</option>
              <option value="likes">Likes</option>
              <option value="comments">Comments</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Upload New Video</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <ChunkedUpload
              videoId={`video_${Date.now()}`}
              userId={userId!}
              onUploadComplete={handleUploadComplete}
              onProgress={handleUploadProgress}
              onError={handleUploadError}
            />
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="bg-gray-800 rounded-lg">
        {videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No videos uploaded yet</div>
            <p className="text-gray-500">Upload your first video to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Upload Video
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {videos.map((video) => (
              <div key={video.id} className="p-6 hover:bg-gray-750 transition-colors">
                <div className="flex items-start space-x-4">
                  {/* Thumbnail */}
                  <div className="relative">
                    <img
                      src={video.thumbnailUrl || '/default-thumbnail.png'}
                      alt={video.title}
                      className="w-40 h-24 object-cover rounded-lg"
                    />
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{video.title}</h3>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                          {video.description || 'No description'}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                          <span>{formatViews(video.viewCount)} views</span>
                          <span>{video.likeCount} likes</span>
                          <span>{video.commentCount} comments</span>
                          {video.publishedAt && (
                            <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <div className="flex items-center space-x-1">
                          {getVisibilityIcon(video.visibility)}
                          <span className="text-sm text-gray-400">{video.visibility}</span>
                        </div>
                        <span className={`text-sm ${getStatusColor(video.status)}`}>
                          {video.status}
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    {video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {video.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {video.tags.length > 3 && (
                          <span className="text-gray-400 text-xs">
                            +{video.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleVideoEdit(video)}
                      className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      title="Edit video"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => window.open(`/video/${video.id}`, '_blank')}
                      className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      title="View video"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleVideoDelete(video.id)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      title="Delete video"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Video Modal */}
      {selectedVideo && (
        <VideoEditModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdate={handleVideoUpdate}
        />
      )}
    </div>
  );
}

// Video Edit Modal Component
function VideoEditModal({ 
  video, 
  onClose, 
  onUpdate 
}: { 
  video: Video; 
  onClose: () => void; 
  onUpdate: (videoId: string, updates: Partial<Video>) => void; 
}) {
  const [formData, setFormData] = useState({
    title: video.title,
    description: video.description || '',
    visibility: video.visibility,
    category: video.category || '',
    tags: video.tags.join(', '),
    monetizationEnabled: video.monetizationEnabled
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(video.id, {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Edit Video</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="PUBLIC">Public</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Select Category</option>
                <option value="EDUCATION">Education</option>
                <option value="ENTERTAINMENT">Entertainment</option>
                <option value="MUSIC">Music</option>
                <option value="GAMING">Gaming</option>
                <option value="NEWS">News</option>
                <option value="SPORTS">Sports</option>
                <option value="TECHNOLOGY">Technology</option>
                <option value="LIFESTYLE">Lifestyle</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="monetization"
              checked={formData.monetizationEnabled}
              onChange={(e) => setFormData({ ...formData, monetizationEnabled: e.target.checked })}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="monetization" className="ml-2 text-sm text-gray-300">
              Enable monetization
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}