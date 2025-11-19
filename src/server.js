import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for Render keep-alive ping
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ping endpoint for external services to keep the app alive
app.get('/api/ping', (req, res) => {
  res.status(200).json({ 
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', routes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
