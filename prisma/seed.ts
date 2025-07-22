/**
 * Database Seeder - Test Data Generation
 * Creates sample users, videos, and interactions for development
 */

import { PrismaClient, UserRole, UserStatus, VideoStatus, VideoVisibility, VideoCategory, LikeType } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clear existing data
  await prisma.$executeRaw`DELETE FROM users`
  await prisma.$executeRaw`DELETE FROM videos`
  console.log('🗑️  Cleared existing data')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@videostream.com',
      username: 'admin',
      displayName: 'VideoStream Admin',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
      emailVerified: new Date(),
      bio: 'Platform Administrator',
    }
  })

  // Create sample creators
  const creators = []
  for (let i = 1; i <= 5; i++) {
    const password = await bcrypt.hash('creator123', 12)
    const creator = await prisma.user.create({
      data: {
        email: `creator${i}@videostream.com`,
        username: `creator${i}`,
        displayName: `Content Creator ${i}`,
        firstName: `Creator`,
        lastName: `${i}`,
        password: password,
        role: UserRole.CREATOR,
        status: UserStatus.ACTIVE,
        isVerified: true,
        emailVerified: new Date(),
        bio: `Passionate content creator making amazing videos! Channel ${i}`,
        subscriberCount: Math.floor(Math.random() * 50000) + 1000,
        totalViews: Math.floor(Math.random() * 1000000) + 10000,
        avatar: `https://images.unsplash.com/photo-${1500000000000 + i}?w=150&h=150&fit=crop&crop=face`,
      }
    })
    creators.push(creator)
  }

  // Create regular users
  const users = []
  for (let i = 1; i <= 10; i++) {
    const password = await bcrypt.hash('user123', 12)
    const user = await prisma.user.create({
      data: {
        email: `user${i}@videostream.com`,
        username: `user${i}`,
        displayName: `User ${i}`,
        password: password,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
        avatar: `https://images.unsplash.com/photo-${1600000000000 + i}?w=150&h=150&fit=crop&crop=face`,
      }
    })
    users.push(user)
  }

  console.log(`✅ Created ${creators.length} creators and ${users.length} users`)

  // Create sample videos
  const videoTemplates = [
    {
      title: 'JavaScript Tutorial für Anfänger - Grundlagen lernen',
      description: 'In diesem umfassenden Tutorial lernst du die Grundlagen von JavaScript. Perfect für Anfänger!',
      category: VideoCategory.EDUCATION,
      tags: '["javascript", "tutorial", "programming", "web development"]',
    },
    {
      title: 'React Hooks erklärt - useState, useEffect und mehr',
      description: 'Alle wichtigen React Hooks erklärt mit praktischen Beispielen. Von useState bis zu Custom Hooks.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["react", "hooks", "frontend", "javascript"]',
    },
    {
      title: 'TypeScript vs JavaScript - Was ist besser?',
      description: 'Ein detaillierter Vergleich zwischen TypeScript und JavaScript mit Pro und Contra.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["typescript", "javascript", "comparison", "programming"]',
    },
    {
      title: 'Next.js 15 - Neue Features im Überblick',
      description: 'Alle neuen Features von Next.js 15 erklärt mit Code-Beispielen und Live-Demos.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["nextjs", "react", "web development", "framework"]',
    },
    {
      title: 'CSS Grid vs Flexbox - Wann verwende ich was?',
      description: 'Der ultimative Guide zu CSS Grid und Flexbox mit praktischen Beispielen.',
      category: VideoCategory.EDUCATION,
      tags: '["css", "grid", "flexbox", "layout"]',
    },
    {
      title: 'Node.js und Express.js - Backend entwickeln',
      description: 'Lerne Backend-Entwicklung mit Node.js und Express.js von Grund auf.',
      category: VideoCategory.EDUCATION,
      tags: '["nodejs", "expressjs", "backend", "javascript"]',
    },
    {
      title: 'MongoDB Tutorial - NoSQL Datenbank verstehen',
      description: 'Alles was du über MongoDB wissen musst - von Installation bis zu komplexen Queries.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["mongodb", "database", "nosql", "tutorial"]',
    },
    {
      title: 'Docker für Entwickler - Container leicht gemacht',
      description: 'Docker verstehen und nutzen - Container, Images und Docker Compose erklärt.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["docker", "containers", "devops", "development"]',
    },
    {
      title: 'Git und GitHub - Versionskontrolle meistern',
      description: 'Git Grundlagen, Branching, Merging und GitHub Workflows für Teams.',
      category: VideoCategory.EDUCATION,
      tags: '["git", "github", "version control", "collaboration"]',
    },
    {
      title: 'Vue.js vs React - Framework Vergleich 2024',
      description: 'Detaillierter Vergleich der beiden populärsten Frontend Frameworks.',
      category: VideoCategory.TECHNOLOGY,
      tags: '["vuejs", "react", "frontend", "frameworks"]',
    },
    {
      title: 'Python für Anfänger - Programmieren lernen',
      description: 'Python Grundlagen mit praktischen Projekten und Übungen.',
      category: VideoCategory.EDUCATION,
      tags: '["python", "programming", "tutorial", "beginner"]',
    },
    {
      title: 'Algorithms und Data Structures - Interview Prep',
      description: 'Die wichtigsten Algorithmen und Datenstrukturen für Technical Interviews.',
      category: VideoCategory.EDUCATION,
      tags: '["algorithms", "data structures", "interview", "programming"]',
    },
  ]

  const videos = []
  for (let i = 0; i < videoTemplates.length; i++) {
    const template = videoTemplates[i]
    const creator = creators[i % creators.length]
    const viewCount = Math.floor(Math.random() * 100000) + 100
    const likeCount = Math.floor(viewCount * 0.05) + Math.floor(Math.random() * 100)
    const dislikeCount = Math.floor(likeCount * 0.1) + Math.floor(Math.random() * 10)
    
    const video = await prisma.video.create({
      data: {
        ...template,
        filename: `video_${i + 1}.mp4`,
        originalFilename: `${template.title.substring(0, 20)}.mp4`,
        duration: Math.floor(Math.random() * 1800) + 300, // 5-35 minutes
        resolution: '1920x1080',
        fileSize: Math.floor(Math.random() * 500000000) + 10000000, // 10-500MB
        mimeType: 'video/mp4',
        status: VideoStatus.READY,
        thumbnailUrl: `https://images.unsplash.com/photo-${1500000000000 + i * 100}?w=1280&h=720&fit=crop`,
        visibility: VideoVisibility.PUBLIC,
        viewCount,
        likeCount,
        dislikeCount,
        commentCount: Math.floor(Math.random() * 50) + 1,
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        authorId: creator.id,
        language: 'de',
      }
    })
    videos.push(video)
  }

  console.log(`✅ Created ${videos.length} videos`)

  // Create subscriptions (users subscribe to creators)
  for (const user of users.slice(0, 8)) {
    const subscribedCreators = creators.slice(0, Math.floor(Math.random() * 3) + 1)
    for (const creator of subscribedCreators) {
      await prisma.subscription.create({
        data: {
          subscriberId: user.id,
          subscribedToId: creator.id,
        }
      })
    }
  }

  // Update creator subscriber counts
  for (const creator of creators) {
    const subscriberCount = await prisma.subscription.count({
      where: { subscribedToId: creator.id }
    })
    await prisma.user.update({
      where: { id: creator.id },
      data: { subscriberCount }
    })
  }

  // Create video likes/dislikes
  for (const video of videos.slice(0, 8)) {
    // Random users like/dislike videos
    const likingUsers = users.slice(0, Math.floor(Math.random() * 8) + 2)
    for (const user of likingUsers) {
      const likeType = Math.random() > 0.1 ? LikeType.LIKE : LikeType.DISLIKE
      await prisma.videoLike.create({
        data: {
          userId: user.id,
          videoId: video.id,
          type: likeType,
        }
      })
    }
  }

  // Create watch history
  for (const user of users.slice(0, 6)) {
    const watchedVideos = videos.slice(0, Math.floor(Math.random() * 6) + 3)
    for (const video of watchedVideos) {
      const watchPercentage = Math.random() * 100
      const watchTime = (video.duration! * watchPercentage) / 100
      
      await prisma.watchHistory.create({
        data: {
          userId: user.id,
          videoId: video.id,
          watchTime,
          watchPercentage,
          completed: watchPercentage > 90,
        }
      })
    }
  }

  // Create comments
  const commentTexts = [
    'Großartiges Tutorial! Hat mir sehr geholfen.',
    'Perfekt erklärt, vielen Dank!',
    'Könnt ihr ein Video über Advanced Topics machen?',
    'Sehr hilfreich für mein Projekt.',
    'Endlich verstehe ich das Konzept!',
    'Top Content wie immer 👍',
    'Habt ihr den Code auf GitHub?',
    'Mehr Videos zu diesem Thema bitte!',
    'Super Qualität und tolle Erklärungen.',
    'Das hat mir bei meiner Arbeit geholfen.',
  ]

  for (const video of videos.slice(0, 8)) {
    const commentCount = Math.floor(Math.random() * 8) + 2
    for (let i = 0; i < commentCount; i++) {
      const commenter = users[Math.floor(Math.random() * users.length)]
      const commentText = commentTexts[Math.floor(Math.random() * commentTexts.length)]
      
      await prisma.comment.create({
        data: {
          content: commentText,
          videoId: video.id,
          authorId: commenter.id,
          likeCount: Math.floor(Math.random() * 10),
          dislikeCount: Math.floor(Math.random() * 2),
        }
      })
    }
  }

  // Create playlists
  const playlistTemplates = [
    { title: 'JavaScript Tutorials', description: 'Alle JavaScript Grundlagen' },
    { title: 'React Lernpfad', description: 'Von Basics zu Advanced React' },
    { title: 'Backend Development', description: 'Node.js, APIs und Datenbanken' },
    { title: 'DevOps Tools', description: 'Docker, Git und mehr' },
  ]

  for (let i = 0; i < playlistTemplates.length; i++) {
    const template = playlistTemplates[i]
    const creator = creators[i % creators.length]
    
    const playlist = await prisma.playlist.create({
      data: {
        ...template,
        authorId: creator.id,
      }
    })

    // Add videos to playlist
    const playlistVideos = videos
      .filter(v => v.authorId === creator.id)
      .slice(0, Math.floor(Math.random() * 3) + 2)
    
    for (let j = 0; j < playlistVideos.length; j++) {
      await prisma.playlistVideo.create({
        data: {
          playlistId: playlist.id,
          videoId: playlistVideos[j].id,
          position: j,
        }
      })
    }
  }

  console.log('✅ Created sample subscriptions, likes, comments, and playlists')

  // Create notifications
  for (const user of users.slice(0, 5)) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'NEW_VIDEO',
        title: 'Neues Video verfügbar!',
        message: 'Ein Kanal dem du folgst hat ein neues Video hochgeladen.',
        data: JSON.stringify({ videoId: videos[0].id }),
      }
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Willkommen bei VideoStream Pro!',
        message: 'Entdecke großartige Videos und teile deine eigenen Inhalte.',
      }
    })
  }

  console.log('✅ Created sample notifications')

  console.log('🎉 Database seeding completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`👤 Users: ${1 + creators.length + users.length}`)
  console.log(`🎬 Videos: ${videos.length}`)
  console.log(`💬 Comments: ${await prisma.comment.count()}`)
  console.log(`👍 Likes: ${await prisma.videoLike.count()}`)
  console.log(`📺 Watch History: ${await prisma.watchHistory.count()}`)
  console.log(`🔔 Notifications: ${await prisma.notification.count()}`)
  
  console.log('\n🔐 Test Accounts:')
  console.log('Admin: admin@videostream.com / admin123')
  console.log('Creator: creator1@videostream.com / creator123')
  console.log('User: user1@videostream.com / user123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })