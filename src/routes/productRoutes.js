import express from 'express';
import {
  createProduct,
  getProducts,
  getProduct,
  searchProducts,
  updateProduct,
  deleteProduct,
  addStock,
  reduceStock,
  customerReturn,
  recordShopDamage,
  customerDamageExchange,
  getProductHistory,
  getProductDamaged,
  getAllDamaged,
  updateDamagedStatus,
  updateLowStockThreshold,
  bulkUpdateLowStockThreshold
} from '../controllers/productController.js';
const router = express.Router();

// Demo mode - no auth required
router.post('/', createProduct);
router.get('/search', searchProducts); // Search endpoint (must be before /:id)

// Low stock threshold management (bulk must be before /:id)
router.patch('/bulk-low-stock-threshold', bulkUpdateLowStockThreshold); // Bulk update thresholds

router.get('/', getProducts);
router.get('/:id', getProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Stock operations
router.post('/:id/stock/add', addStock); // Add from supplier
router.post('/:id/stock/reduce', reduceStock); // Sell to customer
router.post('/:id/stock/return', customerReturn); // Customer returns
router.post('/:id/stock/damage-shop', recordShopDamage); // Shop damage
router.post('/:id/stock/damage-exchange', customerDamageExchange); // Customer damage exchange

// Low stock threshold for single product
router.patch('/:id/low-stock-threshold', updateLowStockThreshold); // Update single product threshold

// History and damaged inventory
router.get('/:id/history', getProductHistory);
router.get('/:id/damaged', getProductDamaged);
router.get('/damaged/all', getAllDamaged);
router.put('/damaged/:id', updateDamagedStatus);

export default router;

