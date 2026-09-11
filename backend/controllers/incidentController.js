import crypto from 'crypto';
import Incident from '../models/Incident.js';
import { isDbConnected } from '../config/db.js';

// In-memory fallback storage when database is disconnected
const inMemoryIncidents = [];

/**
 * Generate a unique Incident ID in the format: SH-INC-XXXXXXXX
 */
const generateIncidentId = () => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SH-INC-${randomHex}`;
};

/**
 * Calculate a deterministic SHA-256 hash for an incident record
 */
export const calculateEvidenceHash = (incident) => {
  const ts = incident.timestamp instanceof Date
    ? incident.timestamp.toISOString()
    : new Date(incident.timestamp).toISOString();

  const stableEvidenceObject = {
    incidentId: String(incident.incidentId || ''),
    deviceId: String(incident.deviceId || ''),
    type: String(incident.type || ''),
    timestamp: ts,
    location: {
      latitude: incident.location?.latitude ?? null,
      longitude: incident.location?.longitude ?? null,
    },
    sensorData: {
      accelerationX: incident.sensorData?.accelerationX ?? null,
      accelerationY: incident.sensorData?.accelerationY ?? null,
      accelerationZ: incident.sensorData?.accelerationZ ?? null,
      gyroX: incident.sensorData?.gyroX ?? null,
      gyroY: incident.sensorData?.gyroY ?? null,
      gyroZ: incident.sensorData?.gyroZ ?? null,
    },
    evidence: {
      sosTriggered: Boolean(incident.evidence?.sosTriggered),
      sensorDataCaptured: Boolean(incident.evidence?.sensorDataCaptured),
      locationCaptured: Boolean(incident.evidence?.locationCaptured),
      mediaCaptured: Boolean(incident.evidence?.mediaCaptured),
    },
  };

  const stableString = JSON.stringify(stableEvidenceObject);
  return crypto.createHash('sha256').update(stableString).digest('hex');
};

/**
 * POST /api/incidents
 * Create a new evidence / incident record
 */
export const createIncident = async (req, res, next) => {
  try {
    const {
      incidentId,
      deviceId = 'SAFEHER-001',
      type = 'SOS',
      status = 'EMERGENCY',
      timestamp,
      location = {},
      sensorData = {},
      evidence = {},
      evidenceHash = null,
      blockchainVerified = false,
    } = req.body;

    const finalIncidentId = incidentId || generateIncidentId();
    const finalTimestamp = timestamp ? new Date(timestamp) : new Date();

    const incidentData = {
      incidentId: finalIncidentId,
      deviceId,
      type,
      status,
      timestamp: finalTimestamp,
      location: {
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
      },
      sensorData: {
        accelerationX: sensorData.accelerationX ?? null,
        accelerationY: sensorData.accelerationY ?? null,
        accelerationZ: sensorData.accelerationZ ?? null,
        gyroX: sensorData.gyroX ?? null,
        gyroY: sensorData.gyroY ?? null,
        gyroZ: sensorData.gyroZ ?? null,
      },
      evidence: {
        sosTriggered: Boolean(evidence.sosTriggered),
        sensorDataCaptured: Boolean(evidence.sensorDataCaptured),
        locationCaptured: Boolean(evidence.locationCaptured),
        mediaCaptured: Boolean(evidence.mediaCaptured),
      },
      evidenceHash: null,
      blockchainVerified,
    };

    // Calculate deterministic SHA-256 evidence hash
    const generatedHash = calculateEvidenceHash(incidentData);
    incidentData.evidenceHash = evidenceHash || generatedHash;

    let savedIncident;

    if (isDbConnected()) {
      savedIncident = await Incident.create(incidentData);
    } else {
      savedIncident = {
        _id: `mem-${Date.now()}`,
        ...incidentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryIncidents.unshift(savedIncident);
    }

    // Broadcast real-time incident event if Socket.IO is attached
    const io = req.app.get('io');
    if (io) {
      io.emit('newIncident', savedIncident);
    }

    return res.status(201).json({
      success: true,
      message: '🚨 Incident record created successfully.',
      data: savedIncident,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/incidents
 * Get recent incidents, newest first
 */
export const getIncidents = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = {};

    if (req.query.deviceId) {
      filter.deviceId = req.query.deviceId;
    }

    if (isDbConnected()) {
      const incidents = await Incident.find(filter)
        .sort({ timestamp: -1 })
        .limit(limit);

      return res.status(200).json({
        success: true,
        count: incidents.length,
        data: incidents,
      });
    }

    let filtered = inMemoryIncidents;
    if (req.query.deviceId) {
      filtered = filtered.filter((inc) => inc.deviceId === req.query.deviceId);
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered.slice(0, limit),
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/incidents/:incidentId/verify
 * Re-computes SHA-256 hash and verifies integrity against stored evidenceHash
 */
export const verifyIncident = async (req, res, next) => {
  try {
    const { incidentId } = req.params;
    let incident;

    if (isDbConnected()) {
      incident = await Incident.findOne({ incidentId });
    } else {
      incident = inMemoryIncidents.find((inc) => inc.incidentId === incidentId);
    }

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: `Incident with ID '${incidentId}' not found.`,
      });
    }

    const calculatedHash = calculateEvidenceHash(incident);
    const storedHash = incident.evidenceHash;
    const integrityVerified = Boolean(storedHash && storedHash === calculatedHash);

    return res.status(200).json({
      success: true,
      incidentId: incident.incidentId,
      integrityVerified,
      storedHash: storedHash || null,
      calculatedHash,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/incidents/:incidentId
 * Get a single incident record by incidentId
 */
export const getIncidentById = async (req, res, next) => {
  try {
    const { incidentId } = req.params;

    if (isDbConnected()) {
      const incident = await Incident.findOne({ incidentId });

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: `Incident with ID '${incidentId}' not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: incident,
      });
    }

    const incident = inMemoryIncidents.find((inc) => inc.incidentId === incidentId);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: `Incident with ID '${incidentId}' not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: incident,
      _source: 'memory_fallback',
    });
  } catch (error) {
    next(error);
  }
};
