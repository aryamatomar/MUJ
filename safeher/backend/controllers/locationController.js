import EmergencyLocation from '../models/EmergencyLocation.js';
import Device from '../models/Device.js';
import { isDbConnected } from '../config/db.js';

// In-memory fallback array for locations during emergency
const inMemoryLocations = [];

/**
 * POST /api/location/update
 * Receives live browser GPS coordinates during active SOS emergency.
 */
export const updateLocation = async (req, res, next) => {
  try {
    const {
      deviceId = process.env.DEVICE_ID || 'SAFEHER-001',
      latitude,
      longitude,
      accuracy = null,
      incidentId = null,
      timestamp = new Date(),
    } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'latitude and longitude are required',
      });
    }

    const locData = {
      deviceId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== null && accuracy !== undefined ? Number(accuracy) : null,
      incidentId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };

    let savedRecord = { _id: `loc-${Date.now()}`, ...locData };

    if (isDbConnected()) {
      savedRecord = await EmergencyLocation.create(locData);
    } else {
      inMemoryLocations.unshift(savedRecord);
      if (inMemoryLocations.length > 200) inMemoryLocations.pop();
    }

    // Broadcast live location to Admin dashboard and connected clients via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('locationUpdate', savedRecord);
      io.emit('liveLocation', savedRecord);
    }

    return res.status(201).json({
      success: true,
      message: 'Live emergency location received and broadcasted.',
      data: savedRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/latest/:deviceId
 * Returns the most recent emergency GPS coordinate for a device.
 */
export const getLatestLocation = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';

    if (isDbConnected()) {
      const latest = await EmergencyLocation.findOne({ deviceId }).sort({ timestamp: -1 });
      return res.status(200).json({
        success: true,
        data: latest,
      });
    }

    const found = inMemoryLocations.find((l) => l.deviceId === deviceId);
    return res.status(200).json({
      success: true,
      data: found || null,
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/history/:deviceId
 * Returns the emergency location trail for an active or past SOS incident.
 */
export const getLocationHistory = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    if (isDbConnected()) {
      const history = await EmergencyLocation.find({ deviceId })
        .sort({ timestamp: -1 })
        .limit(limit);

      return res.status(200).json({
        success: true,
        count: history.length,
        data: history,
      });
    }

    const filtered = inMemoryLocations.filter((l) => l.deviceId === deviceId).slice(0, limit);
    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};
