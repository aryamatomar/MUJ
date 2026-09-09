import SensorData from '../models/SensorData.js';
import { isDbConnected } from '../config/db.js';
import { triggerSos } from './alertController.js';

let demoStreamInterval = null;

/**
 * POST /api/demo/sensor
 * Ingests a single realistic simulated MPU6050 reading and broadcasts it
 */
export const generateDemoSensorData = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';
    const isAgitated = req.body.isAgitated || false;

    let ax, ay, az, gx, gy, gz;

    if (isAgitated) {
      ax = +(0.8 + (Math.random() * 2.2 - 1.1)).toFixed(2);
      ay = +(1.5 + (Math.random() * 2.5 - 1.2)).toFixed(2);
      az = +(9.8 + (Math.random() * 4.0 - 2.0)).toFixed(2);
      gx = +(5.0 + (Math.random() * 15.0 - 7.5)).toFixed(2);
      gy = +(4.2 + (Math.random() * 12.0 - 6.0)).toFixed(2);
      gz = +(6.8 + (Math.random() * 18.0 - 9.0)).toFixed(2);
    } else {
      ax = +(0.2 + (Math.random() * 0.12 - 0.06)).toFixed(2);
      ay = +(0.9 + (Math.random() * 0.1 - 0.05)).toFixed(2);
      az = +(9.72 + (Math.random() * 0.16 - 0.08)).toFixed(2);
      gx = +(1.2 + (Math.random() * 0.4 - 0.2)).toFixed(2);
      gy = +(0.85 + (Math.random() * 0.3 - 0.15)).toFixed(2);
      gz = +(2.1 + (Math.random() * 0.5 - 0.25)).toFixed(2);
    }

    const sensorPacket = {
      deviceId,
      accelerationX: ax,
      accelerationY: ay,
      accelerationZ: az,
      gyroX: gx,
      gyroY: gy,
      gyroZ: gz,
      timestamp: new Date(),
    };

    if (isDbConnected()) {
      await SensorData.create(sensorPacket);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('sensorData', sensorPacket);
    }

    return res.status(200).json({
      success: true,
      message: 'Demo sensor packet generated and broadcasted.',
      data: sensorPacket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/demo/sos
 * Simulates a hardware SOS trigger with demo metadata
 */
export const triggerDemoSos = async (req, res, next) => {
  req.body = {
    ...req.body,
    deviceId: req.body.deviceId || 'SAFEHER-001',
    type: 'Test Alert',
    severity: 'HIGH',
    message: 'Simulated SOS test trigger executed via Demo API.',
    triggeredBy: 'Demo API Pipeline',
  };
  return triggerSos(req, res, next);
};
