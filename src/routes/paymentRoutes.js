import express from 'express';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

/**
 * Payment Routes
 */

// Get pending payments
router.get('/pending', paymentController.getPendingPayments);

// Get all payments
router.get('/', paymentController.getAllPayments);

// Get single payment
router.get('/:id', paymentController.getPaymentById);

// Get customer payment history
router.get('/customer/:customerId', paymentController.getCustomerPaymentHistory);

// Delete payment
router.delete('/:id', paymentController.deletePayment);

export default router;
