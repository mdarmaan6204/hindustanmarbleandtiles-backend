import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import productRoutes from './routes/productRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware - logs ALL requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`\n[${timestamp}] 📨 ${method} ${url}`);
  console.log(`   └─ IP: ${ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✅' : statusCode >= 400 ? '❌' : '⚠️';
    console.log(`   └─ ${statusEmoji} Response: ${statusCode}\n`);
  });
  
  next();
});

// Health check / Keep-alive endpoint
app.get('/api/ping', (req, res) => {
  console.log("ping");
  
  const timestamp = new Date().toISOString();
  const origin = req.get('origin') || req.get('referer') || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  
  // Log to console
  console.log('\n' + '='.repeat(80));
  console.log(`✅ HEALTH CHECK PING RECEIVED`);
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📍 Origin: ${origin}`);
  console.log(`🌐 User Agent: ${userAgent}`);
  console.log(`🔗 URL: ${req.originalUrl}`);
  console.log(`📡 IP Address: ${req.ip || req.connection.remoteAddress}`);
  console.log('='.repeat(80) + '\n');
  
  res.json({ 
    status: 'success',
    message: 'Backend is running and healthy',
    service: 'Hindustan Marble & Tiles API',
    timestamp: timestamp,
    uptime: Math.floor(process.uptime()) + ' seconds',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes with logging
// NOTE: Authentication is now handled entirely on the frontend
// Backend is authentication-agnostic and handles data requests only

app.use('/api/products', (req, res, next) => {
  console.log(`\n📦 [PRODUCTS] ${req.method} ${req.originalUrl}`);
  next();
}, productRoutes);

app.use('/api/exports', (req, res, next) => {
  console.log(`\n📤 [EXPORTS] ${req.method} ${req.originalUrl}`);
  next();
}, exportRoutes);

app.use('/api/customers', (req, res, next) => {
  console.log(`\n👥 [CUSTOMERS] ${req.method} ${req.originalUrl}`);
  next();
}, customerRoutes);

app.use('/api/invoices', (req, res, next) => {
  console.log(`\n📄 [INVOICES] ${req.method} ${req.originalUrl}`);
  next();
}, invoiceRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hindustan Marble & Tiles Backend API',
    version: '1.0.0',
    status: 'running',
    note: 'Authentication handled on frontend only'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB and start server
console.log(`\n🔄 Attempting to connect to MongoDB...`);
console.log(`📍 Connection URI: ${MONGO_URI?.substring(0, 50)}...\n`);

mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('✅ MongoDB CONNECTION SUCCESSFUL');
    console.log('📊 Database: Connected and ready');
    console.log('='.repeat(80));
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(80));
      console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
      console.log(`🔌 Port: ${PORT}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Authentication: Frontend Only (No Backend Auth)`);
      console.log('='.repeat(80) + '\n');
    });
  })
  .catch((err) => {
    console.error('\n' + '='.repeat(80));
    console.error('❌ MongoDB CONNECTION FAILED');
    console.error(`📍 Error: ${err.message}`);
    console.error('='.repeat(80));
    console.error('\n⚠️  Make sure:');
    console.error('   1. MONGO_URI is set in .env');
    console.error('   2. MongoDB is running');
    console.error('   3. Network connection is available');
    console.error('   4. IP whitelist includes your machine\n');
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});