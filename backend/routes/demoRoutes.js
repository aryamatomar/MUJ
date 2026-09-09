import express from 'express';
import {
  generateDemoSensorData,
  triggerDemoSos,
} from '../controllers/demoController.js';

const router = express.Router();

router.post('/sensor', generateDemoSensorData);
router.post('/sos', triggerDemoSos);

export default router;
