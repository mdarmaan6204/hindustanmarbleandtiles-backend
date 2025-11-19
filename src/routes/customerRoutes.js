import express from 'express';
import * as customerController from '../controllers/customerController.js';

const router = express.Router();

/**
 * Customer Routes
 */

// Get all customers
router.get('/', customerController.getAllCustomers);

// Get single customer
router.get('/:id', customerController.getCustomerById);

// Get customer statistics
router.get('/:id/stats', customerController.getCustomerStats);

// Create new customer
router.post('/', customerController.createCustomer);

// Update customer
router.put('/:id', customerController.updateCustomer);

// Delete customer
router.delete('/:id', customerController.deleteCustomer);

export default router;
