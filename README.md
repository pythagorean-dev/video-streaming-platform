# 🎥 VideoStream Pro - YouTube Alternative

Eine vollständige YouTube-Alternative, die mit Next.js 15, TypeScript und Prisma entwickelt wurde.

## ✨ Features

### 🔐 Authentifizierung
- **NextAuth.js** mit mehreren Anbietern
- Email/Passwort Registrierung und Login
- OAuth Support (Google, GitHub)
- JWT-basierte Sicherheit
- Rollenbasierte Zugriffskontrolle (User, Creator, Moderator, Admin)

### 📱 YouTube-Style UI
- Responsive Design mit Dark Theme
- Horizontale Kategorie-Navigation
- Video-Grid mit Thumbnails
- Infinite Scroll Loading
- Professionelle Header-Navigation
- Mobile-optimierte Menüs

### 🎬 Video Management
- Video Upload und Streaming
- Kategorie-System
- Like/Dislike System  
- Kommentar-System mit Replies
- Video-Playlists
- Subscription-System

### 🛡️ Sicherheit & Performance
- Rate Limiting Middleware
- Input Validation mit Zod
- CORS und Security Headers
- Optimized Build Pipeline
- Database Query Optimization

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (Development), PostgreSQL (Production ready)
- **Authentication**: NextAuth.js
- **Validation**: Zod
- **Icons**: Heroicons
- **Deployment**: Vercel-ready

## 🚀 Quick Start

### Voraussetzungen
- Node.js 18+
- npm oder yarn

### Installation

1. **Repository klonen**
```bash
git clone https://github.com/pythagorean-dev/video-streaming-platform.git
cd video-streaming-platform
```

2. **Dependencies installieren**
```bash
npm install
```

3. **Environment Variablen einrichten**
```bash
cp .env.example .env
```

Fülle die `.env` Datei mit deinen Konfigurationen:
```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id" 
GITHUB_CLIENT_SECRET="your-github-client-secret"

# JWT
JWT_SECRET="your-jwt-secret"
```

4. **Datenbank setup**
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

5. **Development Server starten**
```bash
npm run dev
```

Die App ist nun auf [http://localhost:3000](http://localhost:3000) verfügbar!

## 👤 Demo Accounts

Nach dem Seeding stehen folgende Test-Accounts zur Verfügung:

- **Admin**: `admin@videostream.com` / `admin123`
- **Creator**: `creator1@videostream.com` / `creator123`  
- **User**: `user1@videostream.com` / `user123`

## 🤝 Mitwirken

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/amazing-feature`)
3. Committe deine Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushe den Branch (`git push origin feature/amazing-feature`)
5. Öffne eine Pull Request

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz.

---

**Erstellt mit ❤️ und Claude Code**