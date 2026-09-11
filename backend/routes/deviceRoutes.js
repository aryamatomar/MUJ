import express from 'express';
import {
  getDeviceStatus,
  registerDevice,
  resetDevice,
  claimDevice,
  getMyDevice,
} from '../controllers/deviceController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public device endpoints (ESP8266 & telemetry)
router.get('/status', getDeviceStatus);
router.post('/register', registerDevice);
router.post('/reset', resetDevice);

// Authenticated user device endpoints (Step 4A)
router.post('/claim', authenticateToken, claimDevice);
router.get('/my-device', authenticateToken, getMyDevice);

export default router;
