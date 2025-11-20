import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Single-origin CORS (keep this simple)
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsConfig = {
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request log
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} (Origin: ${req.headers.origin || 'n/a'})`);
  next();
});

// Health endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/ping', (req, res) => {
  console.log(`PING /api/ping from ${req.headers.origin || 'n/a'}`);
  res.status(200).json({
    status: 'success',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api', routes);

// Errors
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
      console.log(`Health: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });