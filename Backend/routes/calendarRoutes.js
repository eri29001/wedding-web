import { Router } from 'express';
import { getEvents, createOrUpdateEvent } from '../controllers/calendarController.js';

const router = Router();

router.get('/events', getEvents);
router.post('/events', createOrUpdateEvent);

export default router;