import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      default: 'SAFEHER-001',
      index: true,
    },
    accelerationX: {
      type: Number,
      required: true,
    },
    accelerationY: {
      type: Number,
      required: true,
    },
    accelerationZ: {
      type: Number,
      required: true,
    },
    gyroX: {
      type: Number,
      required: true,
    },
    gyroY: {
      type: Number,
      required: true,
    },
    gyroZ: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

const SensorData = mongoose.model('SensorData', sensorDataSchema);

export default SensorData;
