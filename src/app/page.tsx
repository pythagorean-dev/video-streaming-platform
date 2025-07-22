import Header from '@/components/Header';
import VideoCard from '@/components/VideoCard';

const sampleVideos = [
  {
    id: '1',
    title: 'Einführung in React und Next.js - Vollständiger Leitfaden für Anfänger',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
    duration: '15:42',
    views: 125000,
    uploadDate: '2024-01-15',
    channelName: 'TechAkademie',
    channelAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
  },
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
  },
  {
    id: '4',
    title: 'Responsive Webdesign mit Tailwind CSS - Praktische Beispiele',
    thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
    duration: '12:34',
    views: 156000,
    uploadDate: '2024-01-12',
    channelName: 'WebDesign Pro',
    channelAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b332c387?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: '5',
    title: 'Node.js und Express.js - RESTful API Entwicklung von Grund auf',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
    duration: '28:47',
    views: 234000,
    uploadDate: '2024-01-14',
    channelName: 'Backend Academy',
    channelAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: '6',
    title: 'Docker Container für Entwickler - Komplette Anleitung',
    thumbnail: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=400&h=225&fit=crop',
    duration: '31:22',
    views: 98000,
    uploadDate: '2024-01-09',
    channelName: 'DevOps Master',
    channelAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=40&h=40&fit=crop&crop=face'
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Empfohlene Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sampleVideos.map((video) => (
              <VideoCard key={video.id} {...video} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Trending Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sampleVideos.slice(0, 4).map((video) => (
              <VideoCard key={`trending-${video.id}`} {...video} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}