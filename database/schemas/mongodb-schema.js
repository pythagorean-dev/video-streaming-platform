// MongoDB Schema for Analytics and Logging
// VideoStream Pro - YouTube Alternative

// Database: videostream_analytics

// Video Analytics Collection
db.createCollection("video_analytics", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["videoId", "timestamp", "metrics"],
      properties: {
        videoId: {
          bsonType: "string",
          description: "UUID of the video"
        },
        timestamp: {
          bsonType: "date",
          description: "Timestamp of the analytics data"
        },
        metrics: {
          bsonType: "object",
          required: ["views", "likes", "dislikes", "comments", "shares"],
          properties: {
            views: { bsonType: "long" },
            likes: { bsonType: "int" },
            dislikes: { bsonType: "int" },
            comments: { bsonType: "int" },
            shares: { bsonType: "int" },
            watchTime: { bsonType: "long" }, // in seconds
            retention: {
              bsonType: "object",
              properties: {
                "10": { bsonType: "double" }, // retention at 10%
                "25": { bsonType: "double" }, // retention at 25%
                "50": { bsonType: "double" }, // retention at 50%
                "75": { bsonType: "double" }, // retention at 75%
                "100": { bsonType: "double" } // retention at 100%
              }
            },
            demographics: {
              bsonType: "object",
              properties: {
                ageGroups: {
                  bsonType: "object",
                  properties: {
                    "13-17": { bsonType: "int" },
                    "18-24": { bsonType: "int" },
                    "25-34": { bsonType: "int" },
                    "35-44": { bsonType: "int" },
                    "45-54": { bsonType: "int" },
                    "55-64": { bsonType: "int" },
                    "65+": { bsonType: "int" }
                  }
                },
                genders: {
                  bsonType: "object",
                  properties: {
                    male: { bsonType: "int" },
                    female: { bsonType: "int" },
                    other: { bsonType: "int" }
                  }
                },
                countries: {
                  bsonType: "object",
                  description: "Country code as key, count as value"
                }
              }
            },
            devices: {
              bsonType: "object",
              properties: {
                desktop: { bsonType: "int" },
                mobile: { bsonType: "int" },
                tablet: { bsonType: "int" },
                tv: { bsonType: "int" }
              }
            },
            trafficSources: {
              bsonType: "object",
              properties: {
                direct: { bsonType: "int" },
                search: { bsonType: "int" },
                suggested: { bsonType: "int" },
                social: { bsonType: "int" },
                external: { bsonType: "int" }
              }
            }
          }
        },
        revenue: {
          bsonType: "object",
          properties: {
            adRevenue: { bsonType: "decimal" },
            membershipRevenue: { bsonType: "decimal" },
            superChatRevenue: { bsonType: "decimal" },
            totalRevenue: { bsonType: "decimal" }
          }
        }
      }
    }
  }
});

// User Analytics Collection
db.createCollection("user_analytics", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "timestamp", "metrics"],
      properties: {
        userId: {
          bsonType: "string",
          description: "UUID of the user"
        },
        timestamp: {
          bsonType: "date",
          description: "Timestamp of the analytics data"
        },
        metrics: {
          bsonType: "object",
          required: ["subscribers", "views", "videos"],
          properties: {
            subscribers: { bsonType: "int" },
            views: { bsonType: "long" },
            videos: { bsonType: "int" },
            watchTime: { bsonType: "long" },
            likes: { bsonType: "long" },
            comments: { bsonType: "long" },
            revenue: { bsonType: "decimal" },
            engagementRate: { bsonType: "double" },
            subscriberGrowth: { bsonType: "int" },
            topVideos: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  videoId: { bsonType: "string" },
                  title: { bsonType: "string" },
                  views: { bsonType: "long" },
                  watchTime: { bsonType: "long" }
                }
              }
            }
          }
        }
      }
    }
  }
});

// Real-time Viewer Analytics
db.createCollection("realtime_analytics", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["entityType", "entityId", "timestamp", "viewers"],
      properties: {
        entityType: {
          bsonType: "string",
          enum: ["video", "livestream"],
          description: "Type of entity being tracked"
        },
        entityId: {
          bsonType: "string",
          description: "UUID of the video or livestream"
        },
        timestamp: {
          bsonType: "date",
          description: "Timestamp of the measurement"
        },
        viewers: {
          bsonType: "int",
          description: "Current number of viewers"
        },
        chatMessages: {
          bsonType: "int",
          description: "Number of chat messages (for livestreams)"
        },
        superChats: {
          bsonType: "int",
          description: "Number of super chats (for livestreams)"
        }
      }
    }
  }
});

// Search Analytics
db.createCollection("search_analytics", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["query", "timestamp", "results"],
      properties: {
        query: {
          bsonType: "string",
          description: "Search query"
        },
        timestamp: {
          bsonType: "date",
          description: "When the search was performed"
        },
        userId: {
          bsonType: "string",
          description: "UUID of the user (optional for anonymous searches)"
        },
        results: {
          bsonType: "int",
          description: "Number of results returned"
        },
        clickedResults: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              videoId: { bsonType: "string" },
              position: { bsonType: "int" },
              clickTime: { bsonType: "date" }
            }
          }
        },
        filters: {
          bsonType: "object",
          properties: {
            category: { bsonType: "string" },
            duration: { bsonType: "string" },
            uploadDate: { bsonType: "string" },
            quality: { bsonType: "string" }
          }
        }
      }
    }
  }
});

// Application Logs
db.createCollection("application_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["level", "timestamp", "service", "message"],
      properties: {
        level: {
          bsonType: "string",
          enum: ["error", "warn", "info", "debug"],
          description: "Log level"
        },
        timestamp: {
          bsonType: "date",
          description: "When the log was created"
        },
        service: {
          bsonType: "string",
          description: "Name of the microservice"
        },
        message: {
          bsonType: "string",
          description: "Log message"
        },
        userId: {
          bsonType: "string",
          description: "UUID of the user (if applicable)"
        },
        requestId: {
          bsonType: "string",
          description: "Request ID for tracing"
        },
        metadata: {
          bsonType: "object",
          description: "Additional metadata"
        },
        stack: {
          bsonType: "string",
          description: "Stack trace for errors"
        }
      }
    }
  }
});

// Performance Metrics
db.createCollection("performance_metrics", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["service", "timestamp", "metrics"],
      properties: {
        service: {
          bsonType: "string",
          description: "Name of the microservice"
        },
        timestamp: {
          bsonType: "date",
          description: "When the metrics were collected"
        },
        metrics: {
          bsonType: "object",
          required: ["responseTime", "throughput", "errorRate"],
          properties: {
            responseTime: {
              bsonType: "object",
              properties: {
                avg: { bsonType: "double" },
                p50: { bsonType: "double" },
                p95: { bsonType: "double" },
                p99: { bsonType: "double" }
              }
            },
            throughput: {
              bsonType: "double",
              description: "Requests per second"
            },
            errorRate: {
              bsonType: "double",
              description: "Percentage of requests that resulted in errors"
            },
            cpuUsage: { bsonType: "double" },
            memoryUsage: { bsonType: "double" },
            diskUsage: { bsonType: "double" },
            activeConnections: { bsonType: "int" }
          }
        }
      }
    }
  }
});

// Recommendation Engine Data
db.createCollection("recommendations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "timestamp", "recommendations"],
      properties: {
        userId: {
          bsonType: "string",
          description: "UUID of the user"
        },
        timestamp: {
          bsonType: "date",
          description: "When the recommendations were generated"
        },
        context: {
          bsonType: "string",
          enum: ["homepage", "watch_next", "search_related", "trending"],
          description: "Context where recommendations are shown"
        },
        recommendations: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["videoId", "score", "reason"],
            properties: {
              videoId: { bsonType: "string" },
              score: { bsonType: "double" },
              reason: { bsonType: "string" },
              algorithmUsed: { bsonType: "string" }
            }
          }
        },
        userInteractions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              videoId: { bsonType: "string" },
              action: {
                bsonType: "string",
                enum: ["clicked", "watched", "liked", "shared", "skipped"]
              },
              timestamp: { bsonType: "date" }
            }
          }
        }
      }
    }
  }
});

// A/B Testing Results
db.createCollection("ab_tests", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["testId", "userId", "variant", "timestamp"],
      properties: {
        testId: {
          bsonType: "string",
          description: "Unique identifier for the A/B test"
        },
        userId: {
          bsonType: "string",
          description: "UUID of the user"
        },
        variant: {
          bsonType: "string",
          description: "Which variant the user saw (A, B, C, etc.)"
        },
        timestamp: {
          bsonType: "date",
          description: "When the user was assigned to the variant"
        },
        events: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              eventType: { bsonType: "string" },
              eventData: { bsonType: "object" },
              timestamp: { bsonType: "date" }
            }
          }
        },
        conversionEvents: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              eventType: { bsonType: "string" },
              value: { bsonType: "double" },
              timestamp: { bsonType: "date" }
            }
          }
        }
      }
    }
  }
});

// Content Moderation Logs
db.createCollection("moderation_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["contentType", "contentId", "action", "timestamp"],
      properties: {
        contentType: {
          bsonType: "string",
          enum: ["video", "comment", "user", "livestream"],
          description: "Type of content being moderated"
        },
        contentId: {
          bsonType: "string",
          description: "UUID of the content"
        },
        action: {
          bsonType: "string",
          enum: ["flagged", "reviewed", "approved", "rejected", "removed", "age_restricted"],
          description: "Moderation action taken"
        },
        timestamp: {
          bsonType: "date",
          description: "When the action was taken"
        },
        moderatorId: {
          bsonType: "string",
          description: "UUID of the moderator (null for AI moderation)"
        },
        reason: {
          bsonType: "string",
          description: "Reason for the moderation action"
        },
        aiConfidence: {
          bsonType: "double",
          description: "AI confidence score (0-1) if applicable"
        },
        reportId: {
          bsonType: "string",
          description: "UUID of the related report if applicable"
        },
        metadata: {
          bsonType: "object",
          description: "Additional metadata about the moderation"
        }
      }
    }
  }
});

// Create indexes for optimal performance

// Video Analytics Indexes
db.video_analytics.createIndex({ "videoId": 1, "timestamp": -1 });
db.video_analytics.createIndex({ "timestamp": -1 });
db.video_analytics.createIndex({ "metrics.views": -1 });

// User Analytics Indexes  
db.user_analytics.createIndex({ "userId": 1, "timestamp": -1 });
db.user_analytics.createIndex({ "timestamp": -1 });
db.user_analytics.createIndex({ "metrics.subscribers": -1 });

// Real-time Analytics Indexes
db.realtime_analytics.createIndex({ "entityType": 1, "entityId": 1, "timestamp": -1 });
db.realtime_analytics.createIndex({ "timestamp": -1 });

// Search Analytics Indexes
db.search_analytics.createIndex({ "query": "text" });
db.search_analytics.createIndex({ "timestamp": -1 });
db.search_analytics.createIndex({ "userId": 1, "timestamp": -1 });

// Application Logs Indexes
db.application_logs.createIndex({ "level": 1, "timestamp": -1 });
db.application_logs.createIndex({ "service": 1, "timestamp": -1 });
db.application_logs.createIndex({ "timestamp": -1 });
db.application_logs.createIndex({ "requestId": 1 });

// Performance Metrics Indexes
db.performance_metrics.createIndex({ "service": 1, "timestamp": -1 });
db.performance_metrics.createIndex({ "timestamp": -1 });

// Recommendations Indexes
db.recommendations.createIndex({ "userId": 1, "timestamp": -1 });
db.recommendations.createIndex({ "timestamp": -1 });
db.recommendations.createIndex({ "context": 1, "timestamp": -1 });

// A/B Testing Indexes
db.ab_tests.createIndex({ "testId": 1, "userId": 1 });
db.ab_tests.createIndex({ "testId": 1, "variant": 1 });
db.ab_tests.createIndex({ "timestamp": -1 });

// Moderation Logs Indexes
db.moderation_logs.createIndex({ "contentType": 1, "contentId": 1, "timestamp": -1 });
db.moderation_logs.createIndex({ "moderatorId": 1, "timestamp": -1 });
db.moderation_logs.createIndex({ "action": 1, "timestamp": -1 });
db.moderation_logs.createIndex({ "timestamp": -1 });

// TTL indexes for automatic cleanup of old data
db.realtime_analytics.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 86400 }); // 24 hours
db.application_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 2592000 }); // 30 days
db.performance_metrics.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 604800 }); // 7 days

// Aggregation pipeline examples for common analytics queries

// Example: Get video performance over time
const videoPerformanceOverTime = [
  {
    $match: {
      videoId: "video-uuid-here",
      timestamp: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" }
      },
      views: { $sum: "$metrics.views" },
      likes: { $sum: "$metrics.likes" },
      comments: { $sum: "$metrics.comments" },
      watchTime: { $sum: "$metrics.watchTime" }
    }
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
  }
];

// Example: Get top performing videos
const topPerformingVideos = [
  {
    $match: {
      timestamp: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    }
  },
  {
    $group: {
      _id: "$videoId",
      totalViews: { $sum: "$metrics.views" },
      totalLikes: { $sum: "$metrics.likes" },
      totalWatchTime: { $sum: "$metrics.watchTime" },
      avgRetention: { $avg: "$metrics.retention.50" }
    }
  },
  {
    $sort: { totalViews: -1 }
  },
  {
    $limit: 100
  }
];

// Example: User engagement analysis
const userEngagementAnalysis = [
  {
    $match: {
      timestamp: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    }
  },
  {
    $group: {
      _id: "$userId",
      totalViews: { $sum: "$metrics.views" },
      totalWatchTime: { $sum: "$metrics.watchTime" },
      subscriberGrowth: { $sum: "$metrics.subscriberGrowth" },
      avgEngagementRate: { $avg: "$metrics.engagementRate" }
    }
  },
  {
    $sort: { totalViews: -1 }
  }
];

print("MongoDB Analytics Schema created successfully!");
print("Collections created with validators and indexes:");
print("- video_analytics");
print("- user_analytics"); 
print("- realtime_analytics");
print("- search_analytics");
print("- application_logs");
print("- performance_metrics");
print("- recommendations");
print("- ab_tests");
print("- moderation_logs");
print("");
print("Indexes created for optimal query performance");
print("TTL indexes set for automatic data cleanup");
print("Example aggregation pipelines provided for common analytics queries");