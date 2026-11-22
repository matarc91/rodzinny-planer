import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { query, pool, initSchema } from './db.js';
import { initWebPush } from './services/webpush.js';
import { handleConnection } from './services/websocket.js';
import authRoutes from './routes/auth.js';
import familiesRoutes from './routes/families.js';
import stateRoutes from './routes/state.js';
import pushRoutes from './routes/push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const app = express();
const port = process.env.PORT || 3000;

// Inicjalizacja Web Push VAPID
initWebPush();

// Automatyczna inicjalizacja / migracja schematu bazy danych
initSchema().catch((err) => console.error('[DB] Błąd initSchema:', err.message));

// Middleware
app.use(cors({
  origin: true, // Zezwalaj na dowolny origin (Vercel, localhost, subdomeny)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'planer-rodzinny-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'planer-rodzinny-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Trasy API
app.use('/api/auth', authRoutes);
app.use('/api/families', familiesRoutes);
app.use('/api/families/:id/state', stateRoutes);
app.use('/api/push', pushRoutes);

// Serwowanie plików statycznych frontendu (React / Vite PWA w publicDir)
app.use(express.static(publicDir));

// Fallback dla routingu Single Page Application (SPA)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

// Obsługa błędów 404 dla nieznanych tras API
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint nie istnieje' });
});

// Globalny handler błędów
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
});

// Utworzenie serwera HTTP
const server = http.createServer(app);

// Utworzenie i podłączenie serwera WebSocket na tym samym porcie
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  handleConnection(ws, query);
});

// Uruchomienie serwera
server.listen(port, '0.0.0.0', () => {
  console.log(`[API] Serwer Planera Rodzinnego działa na porcie ${port}`);
  console.log(`[WS] Serwer WebSocket nasłuchuje na ścieżce /ws`);
  console.log(`[STATIC] Pliki statyczne serwowane z: ${publicDir}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[API] Zamykanie serwera...');
  wss.close();
  server.close(async () => {
    await pool.end();
    console.log('[API] Połączenia z bazą danych zamknięte. Zakończono.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
