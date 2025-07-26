'use client';

import { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AnalyticsData {
  overview: {
    totalViews: number;
    totalSubscribers: number;
    totalRevenue: number;
    averageViewDuration: number;
    viewsGrowth: number;
    subscribersGrowth: number;
    revenueGrowth: number;
  };
  viewsOverTime: Array<{ date: string; views: number; watchTime: number }>;
  topVideos: Array<{
    id: string;
    title: string;
    views: number;
    revenue: number;
    thumbnail: string;
  }>;
  audienceData: {
    demographics: Array<{ age: string; percentage: number }>;
    geography: Array<{ country: string; percentage: number }>;
    devices: Array<{ device: string; percentage: number }>;
  };
  trafficSources: Array<{ source: string; percentage: number }>;
}

interface AnalyticsDashboardProps {
  userId?: string;
}

export function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    if (userId) {
      fetchAnalytics();
    }
  }, [userId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/dashboard?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-8 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg">No analytics data available</div>
        <p className="text-gray-500 mt-2">Upload some videos to see your analytics</p>
      </div>
    );
  }

  const viewsChartData = {
    labels: analyticsData.viewsOverTime.map(item => 
      new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: 'Views',
        data: analyticsData.viewsOverTime.map(item => item.views),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Watch Time (hours)',
        data: analyticsData.viewsOverTime.map(item => item.watchTime / 3600),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      }
    ],
  };

  const viewsChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(156, 163, 175)'
        }
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const trafficSourcesData = {
    labels: analyticsData.trafficSources.map(item => item.source),
    datasets: [
      {
        data: analyticsData.trafficSources.map(item => item.percentage),
        backgroundColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
          'rgb(139, 92, 246)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgb(156, 163, 175)',
          padding: 20,
        }
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Views</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(analyticsData.overview.totalViews)}
              </p>
            </div>
            <div className={`text-sm ${analyticsData.overview.viewsGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {analyticsData.overview.viewsGrowth >= 0 ? '+' : ''}{analyticsData.overview.viewsGrowth.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Subscribers</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(analyticsData.overview.totalSubscribers)}
              </p>
            </div>
            <div className={`text-sm ${analyticsData.overview.subscribersGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {analyticsData.overview.subscribersGrowth >= 0 ? '+' : ''}{analyticsData.overview.subscribersGrowth.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Revenue</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(analyticsData.overview.totalRevenue)}
              </p>
            </div>
            <div className={`text-sm ${analyticsData.overview.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {analyticsData.overview.revenueGrowth >= 0 ? '+' : ''}{analyticsData.overview.revenueGrowth.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div>
            <p className="text-gray-400 text-sm">Avg. View Duration</p>
            <p className="text-2xl font-bold text-white">
              {formatDuration(analyticsData.overview.averageViewDuration)}
            </p>
          </div>
        </div>
      </div>

      {/* Views Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Views & Watch Time</h3>
        <Line data={viewsChartData} options={viewsChartOptions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Videos */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Videos</h3>
          <div className="space-y-4">
            {analyticsData.topVideos.map((video, index) => (
              <div key={video.id} className="flex items-center space-x-4">
                <span className="text-gray-400 text-sm w-4">{index + 1}</span>
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-16 h-10 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{video.title}</p>
                  <p className="text-gray-400 text-xs">
                    {formatNumber(video.views)} views • {formatCurrency(video.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Traffic Sources</h3>
          <div className="h-64">
            <Doughnut data={trafficSourcesData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Audience Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Age Demographics</h3>
          <div className="space-y-3">
            {analyticsData.audienceData.demographics.map((demo) => (
              <div key={demo.age} className="flex items-center justify-between">
                <span className="text-gray-300">{demo.age}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${demo.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-400 text-sm">{demo.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Countries</h3>
          <div className="space-y-3">
            {analyticsData.audienceData.geography.map((geo) => (
              <div key={geo.country} className="flex items-center justify-between">
                <span className="text-gray-300">{geo.country}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${geo.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-400 text-sm">{geo.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Device Types</h3>
          <div className="space-y-3">
            {analyticsData.audienceData.devices.map((device) => (
              <div key={device.device} className="flex items-center justify-between">
                <span className="text-gray-300">{device.device}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${device.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-400 text-sm">{device.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}