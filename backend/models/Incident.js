import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      default: 'SAFEHER-001',
      index: true,
    },
    type: {
      type: String,
      required: true,
      default: 'SOS',
    },
    status: {
      type: String,
      required: true,
      default: 'EMERGENCY',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    sensorData: {
      accelerationX: { type: Number, default: null },
      accelerationY: { type: Number, default: null },
      accelerationZ: { type: Number, default: null },
      gyroX: { type: Number, default: null },
      gyroY: { type: Number, default: null },
      gyroZ: { type: Number, default: null },
    },
    evidence: {
      sosTriggered: { type: Boolean, default: false },
      sensorDataCaptured: { type: Boolean, default: false },
      locationCaptured: { type: Boolean, default: false },
      mediaCaptured: { type: Boolean, default: false },
    },
    evidenceHash: {
      type: String,
      default: null,
    },
    blockchainVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
