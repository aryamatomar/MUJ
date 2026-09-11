import crypto from 'crypto';
import { ethers } from 'ethers';
import Incident from '../models/Incident.js';
import { isDbConnected } from '../config/db.js';

// In-memory fallback storage when database is disconnected
export const inMemoryIncidents = [];

// EvidenceRegistry contract ABI containing required functions
const EVIDENCE_REGISTRY_ABI = [
  "function registerEvidence(bytes32 incidentId, bytes32 evidenceHash) external",
  "function getEvidence(bytes32 incidentId) external view returns (bytes32 evidenceHash, uint256 timestamp, address registeredBy)",
  "function isEvidenceRegistered(bytes32 incidentId) external view returns (bool)",
];

/**
 * Get an ethers Contract instance connected to Signer (write) or Provider (read).
 * Safely returns null if environment variables are missing.
 */
const getBlockchainContract = (withSigner = false) => {
  try {
    const rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.EVIDENCE_REGISTRY_ADDRESS;

    if (!rpcUrl || !contractAddress) {
      return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    if (withSigner) {
      if (!privateKey) {
        return null;
      }
      const wallet = new ethers.Wallet(privateKey, provider);
      return new ethers.Contract(contractAddress, EVIDENCE_REGISTRY_ABI, wallet);
    }

    return new ethers.Contract(contractAddress, EVIDENCE_REGISTRY_ABI, provider);
  } catch (error) {
    console.error("Blockchain initialization warning:", error.message);
    return null;
  }
};

/**
 * Asynchronously registers incident evidence hash on-chain.
 * Updates MongoDB record on success; fails gracefully without throwing.
 */
export const registerEvidenceOnChain = async (incidentId, evidenceHash) => {
  try {
    if (!incidentId || !evidenceHash) {
      console.error("Blockchain registration skipped: Missing incidentId or evidenceHash");
      return;
    }

    const contract = getBlockchainContract(true);
    if (!contract) {
      console.warn("Blockchain registration skipped: Environment variables or wallet configuration unavailable.");
      return;
    }

    const bytes32IncidentId = ethers.encodeBytes32String(incidentId);

    const cleanHash = String(evidenceHash).replace(/^0x/i, '');
    if (cleanHash.length !== 64) {
      console.error("Blockchain registration skipped: Invalid SHA-256 evidence hash length");
      return;
    }
    const bytes32EvidenceHash = "0x" + cleanHash;

    console.log(`📡 Submitting evidence on-chain for incident ${incidentId}...`);
    const tx = await contract.registerEvidence(bytes32IncidentId, bytes32EvidenceHash, {
      gasLimit: 100000,
      maxPriorityFeePerGas: ethers.parseUnits("25", "gwei"),
      maxFeePerGas: ethers.parseUnits("25", "gwei"),
    });

    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;

    console.log(`✅ On-chain evidence registered for incident ${incidentId}. Tx Hash: ${txHash}`);

    if (isDbConnected()) {
      await Incident.findOneAndUpdate(
        { incidentId },
        {
          $set: {
            blockchainVerified: true,
            blockchainTxHash: txHash,
          },
        }
      );
    } else {
      const item = inMemoryIncidents.find((inc) => inc.incidentId === incidentId);
      if (item) {
        item.blockchainVerified = true;
        item.blockchainTxHash = txHash;
      }
    }
  } catch (error) {
    console.error(`❌ Background blockchain registration failed for incident ${incidentId}:`, error.message);
  }
};

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
      blockchainTxHash: null,
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

    // Trigger non-blocking fire-and-forget blockchain registration
    void registerEvidenceOnChain(finalIncidentId, incidentData.evidenceHash).catch((error) => {
      console.error("Background blockchain registration unhandled error:", error.message);
    });

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
 * Re-computes SHA-256 hash and verifies integrity locally and on-chain
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

    // Local SHA-256 hash calculation & integrity check
    const calculatedHash = calculateEvidenceHash(incident);
    const storedHash = incident.evidenceHash;
    const integrityVerified = Boolean(storedHash && storedHash === calculatedHash);

    // On-chain blockchain verification
    let onChainVerified = false;
    let onChainDetails = null;

    try {
      const contract = getBlockchainContract(false);
      if (contract) {
        const bytes32IncidentId = ethers.encodeBytes32String(incident.incidentId);
        const isRegistered = await contract.isEvidenceRegistered(bytes32IncidentId);

        if (isRegistered) {
          const [onChainBytes32Hash, blockTimestamp, registeredBy] = await contract.getEvidence(bytes32IncidentId);
          const onChainHashHex = String(onChainBytes32Hash).replace(/^0x/i, '').toLowerCase();
          const localCalculatedLower = String(calculatedHash).toLowerCase();

          if (onChainHashHex === localCalculatedLower) {
            onChainVerified = true;
          }

          onChainDetails = {
            onChainHash: "0x" + onChainHashHex,
            timestamp: Number(blockTimestamp),
            registeredBy,
          };

          if (onChainVerified && isDbConnected() && !incident.blockchainVerified) {
            await Incident.findOneAndUpdate(
              { incidentId: incident.incidentId },
              { $set: { blockchainVerified: true } }
            );
          }
        }
      }
    } catch (blockchainErr) {
      console.warn("On-chain verification query failed gracefully:", blockchainErr.message);
    }

    return res.status(200).json({
      success: true,
      incidentId: incident.incidentId,
      integrityVerified,
      storedHash: storedHash || null,
      calculatedHash,
      blockchainVerified: onChainVerified,
      blockchainTxHash: incident.blockchainTxHash || null,
      onChainDetails,
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
