import SensorData from '../models/SensorData.js';
import Device from '../models/Device.js';
import { isDbConnected } from '../config/db.js';

// Fallback in-memory history for quick telemetry cache
const inMemorySensorHistory = [];

/**
 * POST /api/sensor/data
 * Ingests 6-axis MPU6050 accelerometer and gyroscope data from ESP32 or simulation
 */
export const postSensorData = async (req, res, next) => {
  try {
    const {
      deviceId = process.env.DEVICE_ID || 'SAFEHER-001',
      accelerationX,
      accelerationY,
      accelerationZ,
      gyroX,
      gyroY,
      gyroZ,
    } = req.body;

    if (
      accelerationX === undefined ||
      accelerationY === undefined ||
      accelerationZ === undefined ||
      gyroX === undefined ||
      gyroY === undefined ||
      gyroZ === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required sensor fields (accelerationX, accelerationY, accelerationZ, gyroX, gyroY, gyroZ).',
      });
    }

    const readingData = {
      deviceId,
      accelerationX: Number(Number(accelerationX).toFixed(2)),
      accelerationY: Number(Number(accelerationY).toFixed(2)),
      accelerationZ: Number(Number(accelerationZ).toFixed(2)),
      gyroX: Number(Number(gyroX).toFixed(2)),
      gyroY: Number(Number(gyroY).toFixed(2)),
      gyroZ: Number(Number(gyroZ).toFixed(2)),
      timestamp: new Date(),
    };

    let savedData = readingData;

    if (isDbConnected()) {
      savedData = await SensorData.create(readingData);

      // Update device lastSeen timestamp
      await Device.updateOne({ deviceId }, { $set: { lastSeen: new Date(), status: 'ONLINE' } });
    } else {
      inMemorySensorHistory.unshift(readingData);
      if (inMemorySensorHistory.length > 200) {
        inMemorySensorHistory.pop();
      }
    }

    // Broadcast live telemetry via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('sensorData', readingData);
    }

    return res.status(201).json({
      success: true,
      data: savedData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sensor/latest
 * Returns most recent sensor packet
 */
export const getLatestSensor = async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';

    if (isDbConnected()) {
      const latest = await SensorData.findOne({ deviceId }).sort({ timestamp: -1 });
      if (latest) {
        return res.status(200).json({
          success: true,
          data: latest,
        });
      }
    }

    if (inMemorySensorHistory.length > 0) {
      return res.status(200).json({
        success: true,
        data: inMemorySensorHistory[0],
        _source: 'memory_fallback',
      });
    }

    // Default resting values
    return res.status(200).json({
      success: true,
      data: {
        deviceId,
        accelerationX: 0.24,
        accelerationY: 0.91,
        accelerationZ: 9.72,
        gyroX: 1.2,
        gyroY: 0.85,
        gyroZ: 2.1,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sensor/history
 * Returns recent readings (e.g. ?limit=50&deviceId=SAFEHER-001)
 */
export const getSensorHistory = async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

    if (isDbConnected()) {
      const history = await SensorData.find({ deviceId })
        .sort({ timestamp: -1 })
        .limit(limit);

      return res.status(200).json({
        success: true,
        count: history.length,
        data: history,
      });
    }

    return res.status(200).json({
      success: true,
      count: inMemorySensorHistory.slice(0, limit).length,
      data: inMemorySensorHistory.slice(0, limit),
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};
