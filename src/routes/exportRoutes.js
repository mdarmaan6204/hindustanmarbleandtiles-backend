import express from 'express';
import { exportProductsExcel, exportProductsPDF } from '../controllers/exportController.js';
const router = express.Router();

router.get('/products.xlsx', exportProductsExcel);
router.get('/products.pdf', exportProductsPDF);

export default router;
