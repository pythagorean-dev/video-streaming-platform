const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Videodateien sind erlaubt!'));
    }
  }
});

let videos = [
  {
    id: '1',
    title: 'Einführung in React und Next.js',
    description: 'Vollständiger Leitfaden für Anfänger',
    filename: 'sample-video-1.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
    duration: '15:42',
    views: 125000,
    uploadDate: '2024-01-15',
    channelName: 'TechAkademie',
    channelAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    tags: ['react', 'nextjs', 'javascript', 'tutorial']
  },
  {
    id: '2',
    title: 'JavaScript ES6+ Features',
    description: 'Features die jeder Entwickler kennen sollte',
    filename: 'sample-video-2.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&h=225&fit=crop',
    duration: '22:18',
    views: 87500,
    uploadDate: '2024-01-10',
    channelName: 'CodeMaster',
    channelAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    tags: ['javascript', 'es6', 'programming']
  }
];

app.get('/api/videos', (req, res) => {
  const { search, limit = 10 } = req.query;
  
  let filteredVideos = videos;
  
  if (search) {
    filteredVideos = videos.filter(video => 
      video.title.toLowerCase().includes(search.toLowerCase()) ||
      video.description.toLowerCase().includes(search.toLowerCase()) ||
      video.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );
  }
  
  const limitedVideos = filteredVideos.slice(0, parseInt(limit));
  res.json(limitedVideos);
});

app.get('/api/videos/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video nicht gefunden' });
  }
  
  video.views += 1;
  res.json(video);
});

app.post('/api/videos/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Videodatei hochgeladen' });
    }

    const { title, description, channelName, tags } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Titel und Beschreibung sind erforderlich' });
    }

    const newVideo = {
      id: (videos.length + 1).toString(),
      title,
      description,
      filename: req.file.filename,
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
      duration: '00:00',
      views: 0,
      uploadDate: new Date().toISOString().split('T')[0],
      channelName: channelName || 'Anonymous',
      channelAvatar: null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    videos.push(newVideo);
    res.status(201).json({ message: 'Video erfolgreich hochgeladen', video: newVideo });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Hochladen des Videos' });
  }
});

app.get('/api/videos/:id/stream', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video nicht gefunden' });
  }

  const videoPath = path.join(__dirname, '..', 'uploads', video.filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Videodatei nicht gefunden' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

app.delete('/api/videos/:id', (req, res) => {
  const videoIndex = videos.findIndex(v => v.id === req.params.id);
  if (videoIndex === -1) {
    return res.status(404).json({ error: 'Video nicht gefunden' });
  }

  const video = videos[videoIndex];
  const videoPath = path.join(__dirname, '..', 'uploads', video.filename);
  
  if (fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath);
  }
  
  videos.splice(videoIndex, 1);
  res.json({ message: 'Video erfolgreich gelöscht' });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei ist zu groß (max. 500MB)' });
    }
  }
  
  res.status(500).json({ error: error.message || 'Interner Serverfehler' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});