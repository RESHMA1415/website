import { Router } from 'express';
import mongoose from 'mongoose';
import adminRoutes from './adminRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import customerRoutes from './customerRoutes.js';
import settingsRoutes from './settingsRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

router.use(settingsRoutes);
router.use(catalogRoutes);
router.use(customerRoutes);
router.use('/admin', adminRoutes);

// Later phases mount here: /orders, /payments, /reviews

export default router;
