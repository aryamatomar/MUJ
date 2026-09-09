import Device from '../models/Device.js';
import { isDbConnected } from '../config/db.js';

// In-memory fallback state if MongoDB is offline
let fallbackDevice = {
  deviceId: 'SAFEHER-001',
  deviceName: 'SafeHer Band',
  status: 'ONLINE',
  safetyStatus: 'SAFE',
  sosButton: 'INACTIVE',
  buzzer: 'OFF',
  rgbLed: 'GREEN',
  batteryLevel: 92,
  wifiSignal: -55,
  lastSeen: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * GET /api/device/status
 * Returns current device state
 */
export const getDeviceStatus = async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';

    if (isDbConnected()) {
      let device = await Device.findOne({ deviceId });
      if (!device) {
        device = await Device.create({
          deviceId,
          deviceName: 'SafeHer Band',
          status: 'ONLINE',
          safetyStatus: 'SAFE',
          sosButton: 'INACTIVE',
          buzzer: 'OFF',
          rgbLed: 'GREEN',
          batteryLevel: 92,
          wifiSignal: -55,
        });
      }
      return res.status(200).json({
        success: true,
        data: device,
      });
    }

    // Fallback if DB is disconnected
    return res.status(200).json({
      success: true,
      data: fallbackDevice,
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/device/register
 * Registers or updates a SafeHer device
 */
export const registerDevice = async (req, res, next) => {
  try {
    const { deviceId, deviceName, batteryLevel, wifiSignal, status } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required',
      });
    }

    if (isDbConnected()) {
      const device = await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            deviceName: deviceName || 'SafeHer Band',
            batteryLevel: batteryLevel !== undefined ? batteryLevel : 92,
            wifiSignal: wifiSignal !== undefined ? wifiSignal : -55,
            status: status || 'ONLINE',
            lastSeen: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      // Broadcast update over Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('deviceStatus', device);
      }

      return res.status(201).json({
        success: true,
        data: device,
      });
    }

    // Fallback
    fallbackDevice = {
      ...fallbackDevice,
      deviceId,
      deviceName: deviceName || fallbackDevice.deviceName,
      batteryLevel: batteryLevel !== undefined ? batteryLevel : fallbackDevice.batteryLevel,
      wifiSignal: wifiSignal !== undefined ? wifiSignal : fallbackDevice.wifiSignal,
      status: status || fallbackDevice.status,
      lastSeen: new Date(),
      updatedAt: new Date(),
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('deviceStatus', fallbackDevice);
    }

    return res.status(201).json({
      success: true,
      data: fallbackDevice,
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/device/reset
 * Resets safety status back to SAFE, buzzer to OFF, RGB LED to GREEN, SOS button to INACTIVE
 */
export const resetDevice = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';

    let updatedDevice;

    if (isDbConnected()) {
      updatedDevice = await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            safetyStatus: 'SAFE',
            sosButton: 'INACTIVE',
            buzzer: 'OFF',
            rgbLed: 'GREEN',
            lastSeen: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } else {
      fallbackDevice = {
        ...fallbackDevice,
        safetyStatus: 'SAFE',
        sosButton: 'INACTIVE',
        buzzer: 'OFF',
        rgbLed: 'GREEN',
        lastSeen: new Date(),
        updatedAt: new Date(),
      };
      updatedDevice = fallbackDevice;
    }

    // Broadcast reset via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('deviceStatus', updatedDevice);
      io.emit('alertResolved', {
        deviceId,
        message: 'System reset to SAFE state.',
        timestamp: new Date(),
        device: updatedDevice,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device alert state reset to SAFE successfully.',
      data: updatedDevice,
    });
  } catch (error) {
    next(error);
  }
};
