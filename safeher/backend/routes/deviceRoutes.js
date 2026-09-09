import express from 'express';
import {
  getDeviceStatus,
  registerDevice,
  resetDevice,
} from '../controllers/deviceController.js';

const router = express.Router();

router.get('/status', getDeviceStatus);
router.post('/register', registerDevice);
router.post('/reset', resetDevice);

export default router;
