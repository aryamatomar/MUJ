import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { connectDB, isDbConnected } from './config/db.js';
import deviceRoutes from './routes/deviceRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import demoRoutes from './routes/demoRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import Device from './models/Device.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup Socket.IO with CORS (Allows deployed frontend, Vercel/Render URLs, and local development)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Attach io instance to express app for use inside route controllers
app.set('io', io);

// Middleware
app.use(
  cors({
    origin: '*', // Allow all origins for ESP8266 IoT devices, mobile browsers & web frontends
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for development
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root endpoint for deployment uptime ping
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'SafeHer IoT & Emergency Monitoring Backend',
    health: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeHer backend is running',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: isDbConnected() ? 'connected' : 'memory_fallback_active',
    socket: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/device', deviceRoutes);
app.use('/api/sensor', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/incidents', alertRoutes); // Alias for incidents / audit trail
app.use('/api/demo', demoRoutes);
app.use('/api/location', locationRoutes);

// 404 and Global Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO Connection Lifecycle
io.on('connection', async (socket) => {
  console.log(`🔌 New client connected to SafeHer real-time stream (id: ${socket.id})`);

  // Send current device status upon connection
  try {
    const deviceId = process.env.DEVICE_ID || 'SAFEHER-001';
    let currentDevice = {
      deviceId,
      deviceName: 'SafeHer Band',
      status: 'ONLINE',
      safetyStatus: 'SAFE',
      sosButton: 'INACTIVE',
      buzzer: 'OFF',
      rgbLed: 'GREEN',
      wifiSignal: -55,
      lastSeen: new Date(),
    };

    if (isDbConnected()) {
      const found = await Device.findOne({ deviceId });
      if (found) currentDevice = found;
    }

    socket.emit('deviceStatus', currentDevice);
  } catch (err) {
    console.warn('Socket initial state error:', err.message);
  }

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected (id: ${socket.id})`);
  });
});

// Start Server and Database Connection
const startServer = async () => {
  await connectDB();

  server.listen(PORT, HOST, () => {
    console.log(`
======================================================
  🛡️  SafeHer Women Safety IoT Backend Server
  🚀  Listening on: http://${HOST}:${PORT} (Port: ${PORT})
  📡  Health Check: /api/health
  🔌  Socket.IO: Ready for real-time telemetry & SOS
  🗄️   Database: ${isDbConnected() ? 'MongoDB Connected' : 'In-Memory Fallback Active'}
======================================================
    `);
  });
};

startServer();

export { app, server, io };
