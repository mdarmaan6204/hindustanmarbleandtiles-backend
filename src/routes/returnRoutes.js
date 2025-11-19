import express from 'express';
import {
  createReturn,
  getAllReturns,
  getReturnById,
  getCustomerCredit,
  useCredit
} from '../controllers/returnController.js';

const router = express.Router();

// Return routes
router.post('/', createReturn);
router.get('/', getAllReturns);
router.get('/:id', getReturnById);
router.get('/customer/:customerId/credit', getCustomerCredit);
router.post('/use-credit', useCredit);

export default router;
