import express from 'express';
import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import exportRoutes from './exportRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import stockHistoryRoutes from './stockHistoryRoutes.js';
import damageRoutes from './damageRoutes.js';
import customerRoutes from './customerRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import reportRoutes from './reportRoutes.js';
import returnRoutes from './returnRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/exports', exportRoutes);
router.use('/upload', uploadRoutes);
router.use('/stock-history', stockHistoryRoutes);
router.use('/damage', damageRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/returns', returnRoutes);

export default router;
