import Device from '../models/Device.js';
import User from '../models/User.js';
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
    const { deviceId, deviceName, wifiSignal, status } = req.body;

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

/**
 * POST /api/device/claim
 * Associates an authenticated USER with an ESP8266 device
 */
export const claimDevice = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Device service temporarily unavailable.',
      });
    }

    const { deviceId } = req.body;
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required.',
      });
    }

    const cleanDeviceId = deviceId.trim();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required.',
      });
    }

    // 1. Find device by deviceId
    const device = await Device.findOne({ deviceId: cleanDeviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device with ID '${cleanDeviceId}' not found.`,
      });
    }

    // 2. Check if device is already claimed by another user
    if (device.userId && device.userId.toString() !== userId) {
      return res.status(409).json({
        success: false,
        message: 'Device is already claimed by another user.',
      });
    }

    // 3. Ensure 1-to-1 user-device association: unassign any previously claimed device for this user
    await Device.updateMany(
      { userId, _id: { $ne: device._id } },
      { $set: { userId: null } }
    );

    // 4. Assign logged-in user's ID to device
    device.userId = userId;
    await device.save();

    // 4. Update user's deviceId
    const user = await User.findById(userId);
    if (user) {
      user.deviceId = device.deviceId;
      await user.save();
    }

    // 5. Broadcast device update over Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.emit('deviceStatus', device);
    }

    // 6. Return deviceId and owner info (never exposing passwordHash)
    return res.status(200).json({
      success: true,
      message: `Device '${device.deviceId}' successfully claimed.`,
      data: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        status: device.status,
        safetyStatus: device.safetyStatus,
        owner: user
          ? {
              id: user._id.toString(),
              name: user.name,
              username: user.username,
              email: user.email,
              role: user.role,
            }
          : { id: userId },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/device/my-device
 * Returns the device associated with the logged-in user
 */
export const getMyDevice = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Device service temporarily unavailable.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required.',
      });
    }

    // Find device assigned to this user
    const device = await Device.findOne({ userId }).populate('userId', 'name username email role deviceId');
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'No device associated with this account.',
      });
    }

    const owner = device.userId
      ? {
          id: device.userId._id ? device.userId._id.toString() : device.userId.toString(),
          name: device.userId.name,
          username: device.userId.username,
          email: device.userId.email,
          role: device.userId.role,
        }
      : null;

    return res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        status: device.status,
        safetyStatus: device.safetyStatus,
        sosButton: device.sosButton,
        buzzer: device.buzzer,
        rgbLed: device.rgbLed,
        wifiSignal: device.wifiSignal,
        lastSeen: device.lastSeen,
        userId: device.userId?._id ? device.userId._id.toString() : device.userId,
        owner,
      },
    });
  } catch (error) {
    next(error);
  }
};
