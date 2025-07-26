'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';

interface VideoSource {
  src: string;
  type: 'mp4' | 'hls' | 'dash';
  quality?: string;
  label?: string;
}

interface VideoPlayerProps {
  sources: VideoSource[];
  poster?: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

interface PlayerState {
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  fullscreen: boolean;
  pictureInPicture: boolean;
  theatreMode: boolean;
  playbackRate: number;
  quality: string;
  showControls: boolean;
  loading: boolean;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_STEP = 10; // seconds

export default function AdvancedVideoPlayer({
  sources,
  poster,
  title,
  autoplay = false,
  muted = false,
  controls = true,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  onError,
  className = ''
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [state, setState] = useState<PlayerState>({
    playing: false,
    muted,
    volume: 1,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    fullscreen: false,
    pictureInPicture: false,
    theatreMode: false,
    playbackRate: 1,
    quality: 'auto',
    showControls: true,
    loading: true
  });
  
  const [availableQualities, setAvailableQualities] = useState<string[]>(['auto']);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaybackRate, setShowPlaybackRate] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  
  // Initialize video player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sources.length) return;
    
    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    const primarySource = sources[0];
    
    if (primarySource.type === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        hlsRef.current = hls;
        hls.loadSource(primarySource.src);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const levels = hls.levels.map((level, index) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
            label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`
          }));
          
          const qualities = ['auto', ...levels.map(l => l.label)];
          setAvailableQualities(qualities);
          setState(prev => ({ ...prev, loading: false }));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            onError?.('Video streaming error occurred');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = primarySource.src;
        setState(prev => ({ ...prev, loading: false }));
      }
    } else {
      // Regular MP4 video
      video.src = primarySource.src;
      setState(prev => ({ ...prev, loading: false }));
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [sources, onError]);
  
  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleLoadedMetadata = () => {
      setState(prev => ({ 
        ...prev, 
        duration: video.duration,
        loading: false 
      }));
    };
    
    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;
      
      setState(prev => ({ 
        ...prev, 
        currentTime,
        buffered: video.buffered.length > 0 ? video.buffered.end(0) : 0
      }));
      
      onTimeUpdate?.(currentTime, duration);
    };
    
    const handlePlay = () => {
      setState(prev => ({ ...prev, playing: true }));
      onPlay?.();
    };
    
    const handlePause = () => {
      setState(prev => ({ ...prev, playing: false }));
      onPause?.();
    };
    
    const handleEnded = () => {
      setState(prev => ({ ...prev, playing: false }));
      onEnded?.();
    };
    
    const handleVolumeChange = () => {
      setState(prev => ({ 
        ...prev, 
        volume: video.volume,
        muted: video.muted 
      }));
    };
    
    const handleWaiting = () => {
      setState(prev => ({ ...prev, loading: true }));
    };
    
    const handleCanPlay = () => {
      setState(prev => ({ ...prev, loading: false }));
    };
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTimeUpdate, onPlay, onPause, onEnded]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      
      const video = videoRef.current;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-SEEK_STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(SEEK_STEP);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyT':
          e.preventDefault();
          toggleTheatreMode();
          break;
        case 'KeyP':
          e.preventDefault();
          togglePictureInPicture();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setState(prev => ({ ...prev, showControls: true }));
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, showControls: false }));
    }, 3000);
  }, []);
  
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };
  
  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };
  
  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(video.duration, time));
  };
  
  const changeVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = Math.max(0, Math.min(1, video.volume + delta));
  };
  
  const setVolume = (volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = Math.max(0, Math.min(1, volume));
  };
  
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
  };
  
  const setPlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.playbackRate = rate;
    setState(prev => ({ ...prev, playbackRate: rate }));
  };
  
  const setQuality = (quality: string) => {
    if (!hlsRef.current) return;
    
    if (quality === 'auto') {
      hlsRef.current.currentLevel = -1;
    } else {
      const levelIndex = hlsRef.current.levels.findIndex(
        level => `${level.height}p` === quality
      );
      if (levelIndex >= 0) {
        hlsRef.current.currentLevel = levelIndex;
      }
    }
    
    setState(prev => ({ ...prev, quality }));
  };
  
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setState(prev => ({ ...prev, fullscreen: true }));
    } else {
      await document.exitFullscreen();
      setState(prev => ({ ...prev, fullscreen: false }));
    }
  };
  
  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setState(prev => ({ ...prev, pictureInPicture: false }));
      } else {
        await video.requestPictureInPicture();
        setState(prev => ({ ...prev, pictureInPicture: true }));
      }
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
    }
  };
  
  const toggleTheatreMode = () => {
    setState(prev => ({ ...prev, theatreMode: !prev.theatreMode }));
  };
  
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${state.theatreMode ? 'fixed inset-0 z-50' : ''} ${className}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setState(prev => ({ ...prev, showControls: false }))}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        autoPlay={autoplay}
        muted={state.muted}
        playsInline
        onClick={togglePlayPause}
      />
      
      {/* Loading spinner */}
      {state.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
      
      {/* Controls overlay */}
      {controls && (
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            state.showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Play/Pause button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={togglePlayPause}
              className="bg-black bg-opacity-50 rounded-full p-4 hover:bg-opacity-70 transition-all"
            >
              {state.playing ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>
          
          {/* Bottom controls bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            {/* Progress bar */}
            <div className="mb-4">
              <div
                className="w-full h-1 bg-gray-600 rounded cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(percent * state.duration);
                }}
              >
                {/* Buffered progress */}
                <div
                  className="h-full bg-gray-400 rounded"
                  style={{ width: `${(state.buffered / state.duration) * 100}%` }}
                />
                {/* Current progress */}
                <div
                  className="h-full bg-red-600 rounded absolute top-0"
                  style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                {/* Play/Pause */}
                <button onClick={togglePlayPause} className="hover:text-gray-300">
                  {state.playing ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                {/* Volume */}
                <div className="flex items-center space-x-2">
                  <button onClick={toggleMute} className="hover:text-gray-300">
                    {state.muted || state.volume === 0 ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={state.muted ? 0 : state.volume}
                    onChange={(e) => {
                      const volume = parseFloat(e.target.value);
                      setVolume(volume);
                      if (volume > 0 && state.muted) {
                        toggleMute();
                      }
                    }}
                    className="w-20 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                  />
                </div>
                
                {/* Time display */}
                <span className="text-sm">
                  {formatTime(state.currentTime)} / {formatTime(state.duration)}
                </span>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Settings */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
                    </svg>
                  </button>
                  
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg p-2 min-w-48">
                      <button
                        onClick={() => {
                          setShowPlaybackRate(true);
                          setShowSettings(false);
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-700 rounded"
                      >
                        Playback Speed: {state.playbackRate}x
                      </button>
                      {availableQualities.length > 1 && (
                        <button
                          onClick={() => {
                            setShowQuality(true);
                            setShowSettings(false);
                          }}
                          className="block w-full text-left px-3 py-2 hover:bg-gray-700 rounded"
                        >
                          Quality: {state.quality}
                        </button>
                      )}
                    </div>
                  )}
                  
                  {showPlaybackRate && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg p-2 min-w-32">
                      {PLAYBACK_RATES.map(rate => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate);
                            setShowPlaybackRate(false);
                          }}
                          className={`block w-full text-left px-3 py-2 hover:bg-gray-700 rounded ${
                            state.playbackRate === rate ? 'bg-gray-600' : ''
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {showQuality && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg p-2 min-w-32">
                      {availableQualities.map(quality => (
                        <button
                          key={quality}
                          onClick={() => {
                            setQuality(quality);
                            setShowQuality(false);
                          }}
                          className={`block w-full text-left px-3 py-2 hover:bg-gray-700 rounded ${
                            state.quality === quality ? 'bg-gray-600' : ''
                          }`}
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Picture in Picture */}
                <button onClick={togglePictureInPicture} className="hover:text-gray-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
                  </svg>
                </button>
                
                {/* Theatre Mode */}
                <button onClick={toggleTheatreMode} className="hover:text-gray-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/>
                  </svg>
                </button>
                
                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="hover:text-gray-300">
                  {state.fullscreen ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Click outside to close dropdowns */}
      {(showSettings || showPlaybackRate || showQuality) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setShowSettings(false);
            setShowPlaybackRate(false);
            setShowQuality(false);
          }}
        />
      )}
    </div>
  );
}