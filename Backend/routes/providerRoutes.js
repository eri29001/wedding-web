import { Router } from 'express';
import { getProviders, getRecommendations, selectProvider } from '../controllers/providerController.js';

const router = Router();

router.get('/admin/proveedores', getProviders);
router.get('/recommendations/:userId', getRecommendations);
router.post('/proveedores/seleccionar', selectProvider);

export default router;