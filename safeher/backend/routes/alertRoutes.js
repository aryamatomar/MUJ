import express from 'express';
import {
  triggerSos,
  getAlerts,
  resolveAlert,
} from '../controllers/alertController.js';

const router = express.Router();

router.post('/sos', triggerSos);
router.get('/', getAlerts);
router.post('/:id/resolve', resolveAlert);

export default router;
