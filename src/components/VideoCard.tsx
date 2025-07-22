interface VideoCardProps {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  views: number;
  uploadDate: string;
  channelName: string;
  channelAvatar?: string;
}

export default function VideoCard({
  id,
  title,
  thumbnail,
  duration,
  views,
  uploadDate,
  channelName,
  channelAvatar
}: VideoCardProps) {
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
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'vor 1 Tag';
    if (diffDays < 30) return `vor ${diffDays} Tagen`;
    if (diffDays < 365) return `vor ${Math.floor(diffDays / 30)} Monaten`;
    return `vor ${Math.floor(diffDays / 365)} Jahren`;
  };

  return (
    <a href={`/video/${id}`} className="block bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer group">
      <div className="relative">
        <img
          src={thumbnail}
          alt={title}
          className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
          {duration}
        </span>
      </div>
      
      <div className="p-4">
        <div className="flex space-x-3">
          <div className="flex-shrink-0">
            {channelAvatar ? (
              <img
                src={channelAvatar}
                alt={channelName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {channelName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">
              {title}
            </h3>
            <p className="text-gray-400 text-xs mb-1">{channelName}</p>
            <div className="text-gray-400 text-xs">
              {formatViews(views)} Aufrufe • {formatDate(uploadDate)}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}