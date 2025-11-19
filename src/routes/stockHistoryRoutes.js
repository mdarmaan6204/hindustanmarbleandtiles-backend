import express from 'express';
import StockHistory from '../models/StockHistory.js';
import Product from '../models/Product.js';

const router = express.Router();

// Get stock history for a specific product
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    // Fetch all stock history for this product, sorted by most recent first
    const history = await StockHistory.find({ productId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, history, total: history.length });
  } catch (err) {
    next(err);
  }
});

// Get all stock history (admin/reports)
router.get('/', async (req, res, next) => {
  try {
    const { action, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (action) {
      filter.action = action;
    }

    const total = await StockHistory.countDocuments(filter);
    const history = await StockHistory.find(filter)
      .populate('productId', 'productName type size')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ ok: true, history, page: Number(page), limit: Number(limit), total });
  } catch (err) {
    next(err);
  }
});

export default router;
