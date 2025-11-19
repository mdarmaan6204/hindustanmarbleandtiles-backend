import express from 'express';
import * as invoiceController from '../controllers/invoiceController.js';

const router = express.Router();

/**
 * Invoice Routes
 */

// Get dashboard stats
router.get('/stats/dashboard', invoiceController.getDashboardStats);

// Get all invoices
router.get('/', invoiceController.getAllInvoices);

// Get single invoice by ID
router.get('/:id', invoiceController.getInvoiceById);

// Get invoice by invoice number
router.get('/number/:invoiceNumber', invoiceController.getInvoiceByNumber);

// Create new invoice
router.post('/', invoiceController.createInvoice);

// Update invoice
router.put('/:id', invoiceController.updateInvoice);

// Update invoice payment
router.post('/:id/payment', invoiceController.updateInvoicePayment);

// Delete invoice
router.delete('/:id', invoiceController.deleteInvoice);

// Migration: Add totalBeforeDiscount and invoiceValue to existing invoices
router.post('/migrate/update-values', invoiceController.migrateInvoices);

export default router;
