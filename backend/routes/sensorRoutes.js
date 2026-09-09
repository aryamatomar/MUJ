import express from 'express';
import {
  postSensorData,
  getLatestSensor,
  getSensorHistory,
} from '../controllers/sensorController.js';

const router = express.Router();

router.post('/data', postSensorData);
router.get('/latest', getLatestSensor);
router.get('/history', getSensorHistory);

export default router;
