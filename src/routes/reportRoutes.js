import express from 'express';
import { 
  generateProductPDF, 
  generateProductExcel 
} from '../controllers/reportController.js';

const router = express.Router();

// PDF and Excel report routes
router.get('/products/pdf', generateProductPDF);
router.get('/products/excel', generateProductExcel);

export default router;
