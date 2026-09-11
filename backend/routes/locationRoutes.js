import express from 'express';
import {
  updateLocation,
  getLatestLocation,
  getLocationHistory,
} from '../controllers/locationController.js';

const router = express.Router();

// POST /api/location/update - Send live GPS update during emergency
router.post('/update', updateLocation);

// GET /api/location/latest/:deviceId - Fetch latest emergency GPS coordinate
router.get('/latest/:deviceId', getLatestLocation);

// GET /api/location/history/:deviceId - Fetch emergency GPS location history
router.get('/history/:deviceId', getLocationHistory);

export default router;
