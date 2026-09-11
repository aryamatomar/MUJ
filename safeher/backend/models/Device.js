import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'SAFEHER-001',
    },
    deviceName: {
      type: String,
      default: 'SafeHer Band',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
    },
    safetyStatus: {
      type: String,
      enum: ['SAFE', 'EMERGENCY'],
      default: 'SAFE',
    },
    sosButton: {
      type: String,
      enum: ['READY', 'INACTIVE', 'ACTIVE'],
      default: 'INACTIVE',
    },
    buzzer: {
      type: String,
      enum: ['OFF', 'ON'],
      default: 'OFF',
    },
    rgbLed: {
      type: String,
      enum: ['GREEN', 'RED', 'BLUE', 'YELLOW', 'OFF'],
      default: 'GREEN',
    },
    wifiSignal: {
      type: Number,
      default: -55, // dBm (e.g. -30 dBm is excellent, -80 dBm is weak)
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Device = mongoose.model('Device', deviceSchema);

export default Device;
