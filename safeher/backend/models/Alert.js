import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      default: 'SAFEHER-001',
      index: true,
    },
    type: {
      type: String,
      enum: ['SOS Button', 'Fall Detection', 'Abnormal Motion', 'Test Alert', 'Manual Alert'],
      default: 'SOS Button',
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'CRITICAL',
    },
    message: {
      type: String,
      default: 'Emergency SOS alert triggered by device.',
    },
    triggeredBy: {
      type: String,
      default: 'Physical SOS Switch / Dashboard Trigger',
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
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

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
