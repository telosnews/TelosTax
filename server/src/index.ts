import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import chatRoutes from './routes/chat.js';
import batchRoutes from './routes/batch.js';
import extractRoutes from './routes/extract.js';
import { config } from './config.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust first proxy (when behind nginx/cloudflare/etc.) so req.ip is the real client IP.
// Without this, rate limiting uses the proxy's IP and all users share one bucket.
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Security Headers ────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", ...(process.env.API_ORIGIN ? [process.env.API_ORIGIN] : [])],
      imgSrc: ["'self'", "data:", "blob:"],
      workerSrc: ["'self'", "blob:"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
}));

// ─── CORS ────────────────────────────────────────
const DEFAULT_ORIGINS = [
  'http://localhost:5173',   // Vite dev server
  'http://localhost:4173',   // Vite preview
  'http://127.0.0.1:5173',
];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : DEFAULT_ORIGINS;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/extract', extractRoutes);

// Tip links (static URLs from config — no Stripe SDK needed)
app.get('/api/tip-links', (_req, res) => {
  res.json({
    data: {
      small: config.tipLinkSmall || null,
      medium: config.tipLinkMedium || null,
      large: config.tipLinkLarge || null,
    },
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
});

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Tax API server running on http://0.0.0.0:${PORT}`);
});

export default app;
