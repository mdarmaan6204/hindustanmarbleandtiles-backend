import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import { toTotalPieces, normalizePieces } from '../utils/inventory.js';

/**
 * Helper: Calculate available stock
 */
const calculateAvailableStock = (product) => {
  const stockPieces = toTotalPieces(
    product.stock?.boxes || 0,
    product.stock?.pieces || 0,
    product.piecesPerBox || 1
  );
  const salesPieces = toTotalPieces(
    product.sales?.boxes || 0,
    product.sales?.pieces || 0,
    product.piecesPerBox || 1
  );
  const damagePieces = toTotalPieces(
    product.damage?.boxes || 0,
    product.damage?.pieces || 0,
    product.piecesPerBox || 1
  );
  const returnsPieces = toTotalPieces(
    product.returns?.boxes || 0,
    product.returns?.pieces || 0,
    product.piecesPerBox || 1
  );
  
  const availablePieces = stockPieces - salesPieces - damagePieces + returnsPieces;
  return normalizePieces(Math.max(0, availablePieces), product.piecesPerBox || 1);
};

/**
 * Record damage transaction with automatic history tracking
 * Handles: Own Damage, Customer Refund, Exchange Same, Exchange Different
 */
export const recordDamage = async (req, res) => {
  try {
    const {
      damageType, // 'own' | 'customer-refund' | 'exchange-same' | 'exchange-different'
      productId,
      damagedQuantity,
      replacementProductId, // For exchange-different
      replacementQuantity, // For exchanges
      customerName,
      damageReason,
      description // User-provided notes
    } = req.body;
        console.log(" Recorded Damage  ")

    // Validation
    if (!damageType || !productId || !damagedQuantity) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: damageType, productId, damagedQuantity'
      });
    }

    const results = {
      updatedProducts: [],
      historyRecords: []
    };

    // Get damaged product
    const damagedProduct = await Product.findById(productId);
    if (!damagedProduct) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    const damagedBoxes = parseInt(damagedQuantity.boxes) || 0;
    const damagedPieces = parseInt(damagedQuantity.pieces) || 0;

    // Format quantity for display
    const formatQty = (boxes, pieces) => {
      if (boxes === 0 && pieces === 0) return '0';
      if (boxes === 0) return `${pieces} pc`;
      if (pieces === 0) return `${boxes} bx`;
      return `${boxes} bx, ${pieces} pc`;
    };

    // --- SCENARIO 1: Own Damage (Warehouse) ---
    if (damageType === 'own') {
      // Update damage only
      damagedProduct.damage.boxes += damagedBoxes;
      damagedProduct.damage.pieces += damagedPieces;
      await damagedProduct.save();

      // Calculate available stock after damage
      const availableStock = calculateAvailableStock(damagedProduct);

      // Generate system notes
      const systemNotes = `Own damage: ${formatQty(damagedBoxes, damagedPieces)} - Reason: ${damageReason || 'Not specified'}`;

      // Create history record
      const history = await StockHistory.create({
        productId: damagedProduct._id,
        action: 'Damage (Own)',
        change: { boxes: damagedBoxes, pieces: damagedPieces },
        quantity: {
          boxes: availableStock.boxes,
          pieces: availableStock.pieces
        },
        notes: systemNotes,
        description: description || '',
        damageType: 'own',
        damageReason: damageReason || '',
        performedBy: 'demo-user'
      });

      results.updatedProducts.push(damagedProduct);
      results.historyRecords.push(history);
    }

    // --- SCENARIO 2: Customer Return - Refund Only ---
    else if (damageType === 'customer-refund') {
      // Update damage and returns
      damagedProduct.damage.boxes += damagedBoxes;
      damagedProduct.damage.pieces += damagedPieces;
      damagedProduct.returns.boxes += damagedBoxes;
      damagedProduct.returns.pieces += damagedPieces;
      await damagedProduct.save();

      // Calculate available stock after return
      const availableStock = calculateAvailableStock(damagedProduct);

      // Generate system notes
      const systemNotes = `Customer return (damaged): ${formatQty(damagedBoxes, damagedPieces)}${customerName ? ` - Customer: ${customerName}` : ''} - Refunded - Reason: ${damageReason || 'Not specified'}`;

      // Create history record
      const history = await StockHistory.create({
        productId: damagedProduct._id,
        action: 'Damage (Customer Refund)',
        change: { boxes: damagedBoxes, pieces: damagedPieces },
        quantity: {
          boxes: availableStock.boxes,
          pieces: availableStock.pieces
        },
        notes: systemNotes,
        description: description || '',
        damageType: 'customer-refund',
        damageReason: damageReason || '',
        customerName: customerName || '',
        performedBy: 'demo-user'
      });

      results.updatedProducts.push(damagedProduct);
      results.historyRecords.push(history);
    }

    // --- SCENARIO 3: Customer Exchange - Same Product ---
    else if (damageType === 'exchange-same') {
      const replacementBoxes = parseInt(replacementQuantity?.boxes) || 0;
      const replacementPieces = parseInt(replacementQuantity?.pieces) || 0;

      // Update damage, returns, and sales
      damagedProduct.damage.boxes += damagedBoxes;
      damagedProduct.damage.pieces += damagedPieces;
      damagedProduct.returns.boxes += damagedBoxes;
      damagedProduct.returns.pieces += damagedPieces;
      damagedProduct.sales.boxes += replacementBoxes;
      damagedProduct.sales.pieces += replacementPieces;
      await damagedProduct.save();

      // Calculate available stock after exchange
      const availableStock = calculateAvailableStock(damagedProduct);

      // Generate system notes
      const systemNotes = `Customer exchange (same): ${formatQty(damagedBoxes, damagedPieces)} damaged returned, ${formatQty(replacementBoxes, replacementPieces)} fresh given${customerName ? ` - Customer: ${customerName}` : ''}`;

      // Create history record
      const history = await StockHistory.create({
        productId: damagedProduct._id,
        action: 'Damage (Customer Exchange - Same)',
        change: { boxes: damagedBoxes, pieces: damagedPieces },
        quantity: {
          boxes: availableStock.boxes,
          pieces: availableStock.pieces
        },
        notes: systemNotes,
        description: description || '',
        damageType: 'exchange-same',
        damageReason: damageReason || '',
        customerName: customerName || '',
        performedBy: 'demo-user'
      });

      results.updatedProducts.push(damagedProduct);
      results.historyRecords.push(history);
    }

    // --- SCENARIO 4: Customer Exchange - Different Product ---
    else if (damageType === 'exchange-different') {
      if (!replacementProductId || !replacementQuantity) {
        return res.status(400).json({
          ok: false,
          message: 'Replacement product and quantity required for different product exchange'
        });
      }

      const replacementProduct = await Product.findById(replacementProductId);
      if (!replacementProduct) {
        return res.status(404).json({ ok: false, message: 'Replacement product not found' });
      }

      const replacementBoxes = parseInt(replacementQuantity.boxes) || 0;
      const replacementPieces = parseInt(replacementQuantity.pieces) || 0;

      // Update damaged product: damage + returns
      damagedProduct.damage.boxes += damagedBoxes;
      damagedProduct.damage.pieces += damagedPieces;
      damagedProduct.returns.boxes += damagedBoxes;
      damagedProduct.returns.pieces += damagedPieces;
      await damagedProduct.save();

      // Calculate available stock after damaged product return
      const availableStockDamaged = calculateAvailableStock(damagedProduct);

      // Update replacement product: sales
      replacementProduct.sales.boxes += replacementBoxes;
      replacementProduct.sales.pieces += replacementPieces;
      await replacementProduct.save();

      // Calculate available stock after replacement product sale
      const availableStockReplacement = calculateAvailableStock(replacementProduct);

      // Generate system notes for damaged product
      const damagedNotes = `Customer exchange: ${formatQty(damagedBoxes, damagedPieces)} damaged returned, exchanged with ${replacementProduct.productName}${customerName ? ` - Customer: ${customerName}` : ''}`;

      // Create history for damaged product
      const damagedHistory = await StockHistory.create({
        productId: damagedProduct._id,
        action: 'Damage (Customer Exchange - Different)',
        change: { boxes: damagedBoxes, pieces: damagedPieces },
        quantity: {
          boxes: availableStockDamaged.boxes,
          pieces: availableStockDamaged.pieces
        },
        notes: damagedNotes,
        description: description || '',
        damageType: 'exchange-different',
        damageReason: damageReason || '',
        customerName: customerName || '',
        relatedProductId: replacementProduct._id,
        performedBy: 'demo-user'
      });

      // Generate system notes for replacement product
      const replacementNotes = `Exchange for damaged ${damagedProduct.productName} - ${formatQty(replacementBoxes, replacementPieces)} given${customerName ? ` - Customer: ${customerName}` : ''}`;

      // Create history for replacement product
      const replacementHistory = await StockHistory.create({
        productId: replacementProduct._id,
        action: 'Sale (Exchange)',
        change: { boxes: replacementBoxes, pieces: replacementPieces },
        quantity: {
          boxes: availableStockReplacement.boxes,
          pieces: availableStockReplacement.pieces
        },
        notes: replacementNotes,
        description: description || '',
        customerName: customerName || '',
        relatedProductId: damagedProduct._id,
        relatedTransactionId: damagedHistory._id,
        performedBy: 'demo-user'
      });

      // Link transactions
      damagedHistory.relatedTransactionId = replacementHistory._id;
      await damagedHistory.save();

      results.updatedProducts.push(damagedProduct, replacementProduct);
      results.historyRecords.push(damagedHistory, replacementHistory);
    }

    else {
      return res.status(400).json({
        ok: false,
        message: 'Invalid damage type. Must be: own, customer-refund, exchange-same, or exchange-different'
      });
    }

    res.status(200).json({
      ok: true,
      message: 'Damage recorded successfully',
      updatedProducts: results.updatedProducts,
      historyRecords: results.historyRecords
    });

  } catch (error) {
    console.error('Error recording damage:', error);
    res.status(500).json({
      ok: false,
      message: 'Failed to record damage',
      error: error.message
    });
  }
};
