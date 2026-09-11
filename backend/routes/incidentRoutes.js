import express from 'express';
import {
  createIncident,
  getIncidents,
  getIncidentById,
  verifyIncident,
} from '../controllers/incidentController.js';

const router = express.Router();

router.post('/', createIncident);
router.get('/', getIncidents);
router.get('/:incidentId/verify', verifyIncident);
router.get('/:incidentId', getIncidentById);

export default router;
