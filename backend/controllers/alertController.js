import crypto from 'crypto';
import Alert from '../models/Alert.js';
import Device from '../models/Device.js';
import Incident from '../models/Incident.js';
import { isDbConnected } from '../config/db.js';
import { calculateEvidenceHash, registerEvidenceOnChain, inMemoryIncidents } from './incidentController.js';

// Fallback in-memory alerts
const inMemoryAlerts = [
  {
    _id: 'mock-1',
    deviceId: 'SAFEHER-001',
    type: 'SOS Button',
    severity: 'CRITICAL',
    message: 'Manual emergency trigger from device.',
    triggeredBy: 'Physical SOS Switch',
    resolved: true,
    resolvedAt: new Date(Date.now() - 3600000),
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    _id: 'mock-2',
    deviceId: 'SAFEHER-001',
    type: 'Abnormal Motion',
    severity: 'HIGH',
    message: 'Sudden high acceleration impact detected.',
    triggeredBy: 'MPU6050 Motion Engine',
    resolved: true,
    resolvedAt: new Date(Date.now() - 7200000),
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    _id: 'mock-3',
    deviceId: 'SAFEHER-001',
    type: 'Test Alert',
    severity: 'LOW',
    message: 'System self-test telemetry check.',
    triggeredBy: 'Dashboard User',
    resolved: true,
    resolvedAt: new Date(Date.now() - 10800000),
    timestamp: new Date(Date.now() - 10800000),
  },
];

/**
 * POST /api/alerts/sos
 * Triggers SOS Emergency state on device, logs an Alert document,
 * creates an Incident record, and registers evidence on-chain.
 */
export const triggerSos = async (req, res, next) => {
  try {
    const {
      deviceId = process.env.DEVICE_ID || 'SAFEHER-001',
      type = 'SOS Button',
      severity = 'CRITICAL',
      message = 'Emergency SOS Alert Triggered! Immediate assistance requested.',
      triggeredBy = 'Physical SOS Switch / Test Button',
    } = req.body;

    const alertData = {
      deviceId,
      type,
      severity,
      message,
      triggeredBy,
      resolved: false,
      resolvedAt: null,
      timestamp: new Date(),
    };

    let savedAlert = { _id: `alert-${Date.now()}`, ...alertData };
    let updatedDevice;

    if (isDbConnected()) {
      // 1. Create alert document
      savedAlert = await Alert.create(alertData);

      // 2. Update device status to EMERGENCY state
      updatedDevice = await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            safetyStatus: 'EMERGENCY',
            sosButton: 'ACTIVE',
            buzzer: 'ON',
            rgbLed: 'RED',
            lastSeen: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } else {
      inMemoryAlerts.unshift(savedAlert);
      updatedDevice = {
        deviceId,
        deviceName: 'SafeHer Band',
        status: 'ONLINE',
        safetyStatus: 'EMERGENCY',
        sosButton: 'ACTIVE',
        buzzer: 'ON',
        rgbLed: 'RED',
        wifiSignal: -55,
        lastSeen: new Date(),
      };
    }

    // 3. Create corresponding Incident for Blockchain Evidence Tracking
    let savedIncident = null;
    try {
      const finalIncidentId =
        req.body.incidentId ||
        `SH-INC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const incidentData = {
        incidentId: finalIncidentId,
        deviceId,
        type: type || 'SOS',
        status: 'EMERGENCY',
        timestamp: alertData.timestamp,
        location: {
          latitude: req.body.location?.latitude ?? null,
          longitude: req.body.location?.longitude ?? null,
        },
        sensorData: {
          accelerationX: req.body.sensorData?.accelerationX ?? null,
          accelerationY: req.body.sensorData?.accelerationY ?? null,
          accelerationZ: req.body.sensorData?.accelerationZ ?? null,
          gyroX: req.body.sensorData?.gyroX ?? null,
          gyroY: req.body.sensorData?.gyroY ?? null,
          gyroZ: req.body.sensorData?.gyroZ ?? null,
        },
        evidence: {
          sosTriggered: true,
          sensorDataCaptured: Boolean(req.body.sensorData),
          locationCaptured: Boolean(req.body.location),
          mediaCaptured: Boolean(req.body.evidence?.mediaCaptured),
        },
        evidenceHash: null,
        blockchainVerified: false,
        blockchainTxHash: null,
      };

      // Generate SHA-256 evidence hash using existing helper
      const evidenceHash = calculateEvidenceHash(incidentData);
      incidentData.evidenceHash = evidenceHash;

      // Save Incident safely
      if (isDbConnected()) {
        const existing = await Incident.findOne({ incidentId: finalIncidentId });
        if (!existing) {
          savedIncident = await Incident.create(incidentData);
        } else {
          savedIncident = existing;
        }
      } else {
        savedIncident = {
          _id: `mem-${Date.now()}`,
          ...incidentData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryIncidents.unshift(savedIncident);
      }

      // Trigger non-blocking fire-and-forget blockchain registration
      if (savedIncident && incidentData.evidenceHash) {
        void registerEvidenceOnChain(finalIncidentId, incidentData.evidenceHash).catch((error) => {
          console.error("Background blockchain registration failed:", error.message);
        });
      }
    } catch (incidentErr) {
      console.error("Incident creation / evidence tracking warning:", incidentErr.message);
    }

    // 4. Broadcast SOS alert, updated device status, and new Incident over Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('sosAlert', {
        alert: savedAlert,
        device: updatedDevice,
      });
      io.emit('deviceStatus', updatedDevice);

      if (savedIncident) {
        io.emit('newIncident', savedIncident);
      }
    }

    // 5. Return existing response structure
    return res.status(201).json({
      success: true,
      message: '🚨 Emergency SOS broadcasted and logged successfully.',
      data: {
        alert: savedAlert,
        device: updatedDevice,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alerts
 * Returns history of all recorded alerts
 */
export const getAlerts = async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'SAFEHER-001';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    if (isDbConnected()) {
      const alerts = await Alert.find({ deviceId })
        .sort({ timestamp: -1 })
        .limit(limit);

      return res.status(200).json({
        success: true,
        count: alerts.length,
        data: alerts,
      });
    }

    return res.status(200).json({
      success: true,
      count: inMemoryAlerts.length,
      data: inMemoryAlerts.slice(0, limit),
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alerts/:id/resolve
 * Marks an individual alert as resolved
 */
export const resolveAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      const alert = await Alert.findByIdAndUpdate(
        id,
        {
          $set: {
            resolved: true,
            resolvedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: `Alert with id ${id} not found`,
        });
      }

      // Also reset device state
      const device = await Device.findOneAndUpdate(
        { deviceId: alert.deviceId },
        {
          $set: {
            safetyStatus: 'SAFE',
            sosButton: 'INACTIVE',
            buzzer: 'OFF',
            rgbLed: 'GREEN',
          },
        },
        { new: true }
      );

      const io = req.app.get('io');
      if (io) {
        io.emit('alertResolved', { alert, device });
        io.emit('deviceStatus', device);
      }

      return res.status(200).json({
        success: true,
        message: 'Alert marked as resolved.',
        data: alert,
      });
    }

    const item = inMemoryAlerts.find((a) => a._id === id);
    if (item) {
      item.resolved = true;
      item.resolvedAt = new Date();
    }

    return res.status(200).json({
      success: true,
      message: 'Alert marked as resolved in memory.',
      data: item || { _id: id, resolved: true },
    });
  } catch (error) {
    next(error);
  }
};
