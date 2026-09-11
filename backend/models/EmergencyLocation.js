import mongoose from 'mongoose';

const emergencyLocationSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      default: 'SAFEHER-001',
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    incidentId: {
      type: String,
      default: null,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const EmergencyLocation = mongoose.model('EmergencyLocation', emergencyLocationSchema);

export default EmergencyLocation;
