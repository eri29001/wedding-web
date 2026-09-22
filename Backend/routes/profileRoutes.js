import { Router } from 'express';
import { getProfile, saveProfile, saveDocument, getGuests, createGuest } from '../controllers/profileController.js';

const router = Router();

router.get('/profile/:userId', getProfile);
router.post('/guardar-perfil', saveProfile);
router.post('/documentos', saveDocument);
router.get('/guests/:userId', getGuests);
router.post('/guests', createGuest);

export default router;