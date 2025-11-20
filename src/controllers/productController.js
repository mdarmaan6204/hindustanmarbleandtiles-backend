import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import DamagedInventory from '../models/DamagedInventory.js';
import { 
  getPiecesPerBox, 
  normalizePieces, 
  toTotalPieces, 
  calculateAvailable 
} from '../utils/inventory.js';

export const createProduct = async (req, res, next) => {
  try {
    const { 
      productName, type, subType, size, stock, piecesPerBox, 
      description, hsnNo, link3D, location, images 
    } = req.body;
    
    console.log('📦 CREATE PRODUCT REQUEST:', { productName, type, subType, size, stock, images: images?.length || 0 });
    
    // Validate required fields
    if (!type || !size) {
      return res.status(400).json({ 
        ok: false, 
        message: 'Type and Size are required' 
      });
    }
    
    // Only Floor type requires subType
    if (type === 'Floor' && !subType) {
      return res.status(400).json({ 
        ok: false, 
        message: 'SubType is required for Floor tiles' 
      });
    }
    
    // Check if product with same name, type, subType, and size already exists
    const existing = await Product.findOne({ 
      productName: productName,
      type,
      subType: type === 'Floor' ? subType : null,
      size,
      isActive: true 
    });

    if (existing && productName) {
      // Add to existing product's stock
      const { boxes = 0, pieces = 0 } = stock || {};
      
      // Normalize pieces
      const normalized = normalizePieces(pieces, existing.piecesPerBox);
      existing.stock.boxes += boxes + normalized.boxes;
      existing.stock.pieces = normalized.pieces;
      
      // Update legacy quantity field
      const totalPieces = toTotalPieces(existing.stock.boxes, existing.stock.pieces, existing.piecesPerBox);
      existing.quantity = totalPieces;
      
      await existing.save();
      console.log('✅ STOCK ADDED TO EXISTING:', existing.productName, existing._id);
      
      // Create stock history entry
      await StockHistory.create({
        productId: existing._id,
        action: 'add_stock',
        change: { boxes, pieces: normalized.pieces },
        quantity: existing.stock,
        notes: description || 'Stock added',
        performedBy: 'demo-user'
      });
      
      return res.json({ ok: true, success: true, product: existing, message: 'Stock added to existing product' });
    }

    // Create new product
    const genProductName = type === 'Floor' 
      ? `${type} ${subType} ${size}`
      : `${type} ${size}`;

    const product = new Product({
      productName: productName || genProductName,
      type,
      subType: type === 'Floor' ? subType : null,
      size,
      piecesPerBox: piecesPerBox || getPiecesPerBox(size),
      stock: stock || { boxes: 0, pieces: 0 },
      sales: { boxes: 0, pieces: 0 },
      damage: { boxes: 0, pieces: 0 },
      returns: { boxes: 0, pieces: 0 },
      description: description || '',
      hsnNo: hsnNo || '',
      link3D: link3D || '',
      location: location || '',
      images: images || [],
      quantity: toTotalPieces(stock?.boxes || 0, stock?.pieces || 0, piecesPerBox || getPiecesPerBox(size))
    });
    
    await product.save();
    console.log('✅ NEW PRODUCT SAVED:', product.productName, product._id);

    // Create stock history entry
    await StockHistory.create({
      productId: product._id,
      action: 'add_stock',
      change: product.stock,
      quantity: product.stock,
      notes: 'Initial stock',
      performedBy: 'demo-user'
    });

    res.json({ ok: true, success: true, product });
  } catch (err) {
    next(err);
  }
};

export const searchProducts = async (req, res, next) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    
    if (q.trim()) {
      filter.productName = { $regex: q.trim(), $options: 'i' };
    }
    console.log("Searched Product");
    
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .select('productName type size piecesPerBox price stock sales damage returns')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ productName: 1 });
    
    res.json({ 
      ok: true, 
      products,
      page: Number(page), 
      limit: Number(limit), 
      total 
    });
  } catch (err) {
    next(err);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const { q, category, brand, application, inStockOnly, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (q) filter.productName = { $regex: q, $options: 'i' };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (application) filter.application = application;
        console.log("Get Product");

    // Updated to use dual-unit stock check
    if (inStockOnly === 'true') {
      filter.$expr = {
        $gt: [
          { $add: ['$stock.boxes', { $ceil: { $divide: ['$stock.pieces', 1] } }] },
          0
        ]
      };
    }
    
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    // Return format that frontend expects
    res.json({ 
      ok: true, 
      products, // Array of products for frontend
      page: Number(page), 
      limit: Number(limit), 
      total 
    });
  } catch (err) {
    next(err);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }
        console.log("Get Product");

    // Add calculated fields
    let available;
    try {
      available = calculateAvailable(product);
    } catch (calcError) {
      console.error('Error calculating available quantity:', calcError);
      // Fallback to basic calculation if utility fails
      available = { boxes: 0, pieces: 0, totalPieces: 0 };
    }
    
    res.json({ 
      ok: true, 
      product: {
        ...product.toObject(),
        available
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { stock, sales, damage, returns, piecesPerBox, updateNotes, ...otherFields } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }
    console.log("Update Product");

    // Track changes for history
    const changes = [];
    
    // Update dual-unit fields with normalization
    if (stock) {
      const { boxes = 0, pieces = 0 } = stock;
      const normalized = normalizePieces(pieces, product.piecesPerBox);
      product.stock = { boxes: boxes + normalized.boxes, pieces: normalized.pieces };
      changes.push('Stock updated');
    }

    if (sales) {
      const { boxes = 0, pieces = 0 } = sales;
      const normalized = normalizePieces(pieces, product.piecesPerBox);
      product.sales = { boxes: boxes + normalized.boxes, pieces: normalized.pieces };
      changes.push('Sales updated');
    }

    if (damage) {
      const { boxes = 0, pieces = 0 } = damage;
      const normalized = normalizePieces(pieces, product.piecesPerBox);
      product.damage = { boxes: boxes + normalized.boxes, pieces: normalized.pieces };
      changes.push('Damage updated');
    }

    if (returns) {
      const { boxes = 0, pieces = 0 } = returns;
      const normalized = normalizePieces(pieces, product.piecesPerBox);
      product.returns = { boxes: boxes + normalized.boxes, pieces: normalized.pieces };
      changes.push('Returns updated');
    }

    if (piecesPerBox && piecesPerBox !== product.piecesPerBox) {
      product.piecesPerBox = piecesPerBox;
      changes.push(`Tiles per box: ${product.piecesPerBox} → ${piecesPerBox}`);
    }

    // Update other fields and track changes
    for (const [key, value] of Object.entries(otherFields)) {
      if (product[key] !== value) {
        if (key === 'productName') changes.push(`Name: "${product[key]}" → "${value}"`);
        else if (key === 'type') changes.push(`Type: "${product[key]}" → "${value}"`);
        else if (key === 'subType') changes.push(`SubType: "${product[key]}" → "${value}"`);
        else if (key === 'size') changes.push(`Size: "${product[key]}" → "${value}"`);
        else changes.push(`${key} updated`);
        product[key] = value;
      }
    }

    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesPieces = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damagePieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesPieces - damagePieces;

    await product.save();

    // Create history entry for product update
    if (changes.length > 0) {
      try {
        const StockHistory = (await import('../models/StockHistory.js')).default;
        await StockHistory.create({
          product: product._id,
          action: 'Product Update',
          change: { boxes: 0, pieces: 0 },
          quantity: { boxes: product.stock.boxes, pieces: product.stock.pieces },
          notes: updateNotes || changes.join('; '),
          performedBy: req.user?.email || req.body.performedBy || 'system'
        });
      } catch (historyErr) {
        console.error('Failed to create history entry:', historyErr);
        // Continue even if history fails
      }
    }
    res.json({ ok: true, product });
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
    console.log("Delete Product");

// SCENARIO 1: Add Stock - New delivery from supplier
export const addStock = async (req, res, next) => {
  try {
    const { boxes = 0, pieces = 0, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
        console.log("Add Product");

    // Normalize pieces
    const normalized = normalizePieces(pieces, product.piecesPerBox);
    const addBoxes = boxes + normalized.boxes;
    const addPieces = normalized.pieces;
    
    // Store old stock for history
    const oldStock = { ...product.stock };
    
    // Add to stock
    product.stock.boxes += addBoxes;
    product.stock.pieces += addPieces;
    
    // Normalize again in case pieces exceed piecesPerBox
    const finalNormalized = normalizePieces(product.stock.pieces, product.piecesPerBox);
    product.stock.boxes += finalNormalized.boxes;
    product.stock.pieces = finalNormalized.pieces;
    
    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesPieces = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damagePieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesPieces - damagePieces;
    
    await product.save();
    
    await StockHistory.create({
      productId: product._id,
      action: 'add',
      change: { boxes: addBoxes, pieces: addPieces },
      quantity: { boxes: product.stock.boxes, pieces: product.stock.pieces },
      notes,
      performedBy: 'demo-user'
    });
    
    res.json({ ok: true, product, message: 'Stock added successfully' });
  } catch (err) {
    next(err);
  }
};

// SCENARIO 2: Reduce Stock - Sale to customer
export const reduceStock = async (req, res, next) => {
  try {
    const { boxes = 0, pieces = 0, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
        console.log("Reduce Product");

    // Normalize pieces
    const normalized = normalizePieces(pieces, product.piecesPerBox);
    const saleBoxes = boxes + normalized.boxes;
    const salePieces = normalized.pieces;
    
    // Calculate available stock
    const available = calculateAvailable(product);
    const availableTotalPieces = toTotalPieces(available.boxes, available.pieces, product.piecesPerBox);
    const requestTotalPieces = toTotalPieces(saleBoxes, salePieces, product.piecesPerBox);
    
    if (requestTotalPieces > availableTotalPieces) {
      return res.status(400).json({ 
        ok: false, 
        message: `Insufficient stock. Available: ${available.boxes} bx + ${available.pieces} pc` 
      });
    }
    
    // Store old sales for history
    const oldSales = { ...product.sales };
    
    // Add to sales
    product.sales.boxes += saleBoxes;
    product.sales.pieces += salePieces;
    
    // Normalize again in case pieces exceed piecesPerBox
    const finalNormalized = normalizePieces(product.sales.pieces, product.piecesPerBox);
    product.sales.boxes += finalNormalized.boxes;
    product.sales.pieces = finalNormalized.pieces;
    
    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesTotal = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damagePieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesTotal - damagePieces;
    
    await product.save();
    
    await StockHistory.create({
      productId: product._id,
      action: 'sell',
      change: { boxes: saleBoxes, pieces: salePieces },
      previousQuantity: oldSales,
      newQuantity: product.sales,
      notes,
      performedBy: 'demo-user'
    });
    
    res.json({ ok: true, product, message: 'Sale recorded successfully' });
  } catch (err) {
    next(err);
  }
};

// SCENARIO 3: Customer Return - Add back to inventory
export const customerReturn = async (req, res, next) => {
  try {
    const { boxes = 0, pieces = 0, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
    
    // Normalize pieces
    const normalized = normalizePieces(pieces, product.piecesPerBox);
    const returnBoxes = boxes + normalized.boxes;
    const returnPieces = normalized.pieces;
    
    // Store old values for history
    const oldSales = { ...product.sales };
    const oldReturns = { ...product.returns };
    
    // Reduce sales (since items are returned)
    product.sales.boxes = Math.max(0, product.sales.boxes - returnBoxes);
    product.sales.pieces = Math.max(0, product.sales.pieces - returnPieces);
    
    // Add to returns
    product.returns.boxes += returnBoxes;
    product.returns.pieces += returnPieces;
    
    // Normalize again in case pieces exceed piecesPerBox
    const finalNormalized = normalizePieces(product.returns.pieces, product.piecesPerBox);
    product.returns.boxes += finalNormalized.boxes;
    product.returns.pieces = finalNormalized.pieces;
    
    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesTotal = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damagePieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesTotal - damagePieces;
    
    await product.save();
    
    await StockHistory.create({
      productId: product._id,
      action: 'return',
      change: { boxes: returnBoxes, pieces: returnPieces },
      previousSales: oldSales,
      newSales: product.sales,
      previousReturns: oldReturns,
      newReturns: product.returns,
      notes,
      performedBy: 'demo-user'
    });
    
    res.json({ ok: true, product, message: 'Customer return recorded successfully' });
  } catch (err) {
    next(err);
  }
};

// SCENARIO 4: Shop Damage - Move from good stock to damaged inventory
export const recordShopDamage = async (req, res, next) => {
  try {
    const { boxes = 0, pieces = 0, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
    
    // Normalize pieces
    const normalized = normalizePieces(pieces, product.piecesPerBox);
    const damageBoxes = boxes + normalized.boxes;
    const damagePieces = normalized.pieces;
    
    // Calculate available stock
    const available = calculateAvailable(product);
    const availableTotalPieces = toTotalPieces(available.boxes, available.pieces, product.piecesPerBox);
    const requestTotalPieces = toTotalPieces(damageBoxes, damagePieces, product.piecesPerBox);
    
    if (requestTotalPieces > availableTotalPieces) {
      return res.status(400).json({ 
        ok: false, 
        message: `Insufficient available stock. Available: ${available.boxes} bx + ${available.pieces} pc` 
      });
    }
    
    // Store old damage for history
    const oldDamage = { ...product.damage };
    
    // Add to damage
    product.damage.boxes += damageBoxes;
    product.damage.pieces += damagePieces;
    
    // Normalize again in case pieces exceed piecesPerBox
    const finalNormalized = normalizePieces(product.damage.pieces, product.piecesPerBox);
    product.damage.boxes += finalNormalized.boxes;
    product.damage.pieces = finalNormalized.pieces;
    
    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesTotal = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damageTotalPieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesTotal - damageTotalPieces;
    
    await product.save();
    
    // Create damaged inventory record
    await DamagedInventory.create({
      productId: product._id,
      quantity: { boxes: damageBoxes, pieces: damagePieces },
      damageType: 'shop',
      notes,
      recordedBy: 'demo-user',
      description: notes
    });
    
    await StockHistory.create({
      productId: product._id,
      action: 'damage_shop',
      change: { boxes: damageBoxes, pieces: damagePieces },
      previousQuantity: oldDamage,
      newQuantity: product.damage,
      damageType: 'shop',
      notes,
      performedBy: 'demo-user'
    });
    
    res.json({ ok: true, product, message: 'Shop damage recorded successfully' });
  } catch (err) {
    next(err);
  }
};

// SCENARIO 5: Customer Damage Exchange - Remove damaged tiles, add new ones
export const customerDamageExchange = async (req, res, next) => {
  try {
    const { damageBoxes = 0, damagePieces = 0, newBoxes = 0, newPieces = 0, notes } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
    console.log("Damage Product");
    
    // Normalize damage
    const damagNorm = normalizePieces(damagePieces, product.piecesPerBox);
    const totalDamageBoxes = damageBoxes + damagNorm.boxes;
    const totalDamagePieces = damagNorm.pieces;
    
    // Normalize new tiles
    const newNorm = normalizePieces(newPieces, product.piecesPerBox);
    const totalNewBoxes = newBoxes + newNorm.boxes;
    const totalNewPieces = newNorm.pieces;
    
    // Calculate available stock
    const available = calculateAvailable(product);
    const availableTotalPieces = toTotalPieces(available.boxes, available.pieces, product.piecesPerBox);
    const requestTotalPieces = toTotalPieces(totalNewBoxes, totalNewPieces, product.piecesPerBox);
    
    if (requestTotalPieces > availableTotalPieces) {
      return res.status(400).json({ 
        ok: false, 
        message: `Insufficient available stock. Available: ${available.boxes} bx + ${available.pieces} pc` 
      });
    }
    
    // Store old values for history
    const oldSales = { ...product.sales };
    const oldDamage = { ...product.damage };
    
    // Increase sales (new tiles given to customer)
    product.sales.boxes += totalNewBoxes;
    product.sales.pieces += totalNewPieces;
    
    // Normalize sales
    const salesNorm = normalizePieces(product.sales.pieces, product.piecesPerBox);
    product.sales.boxes += salesNorm.boxes;
    product.sales.pieces = salesNorm.pieces;
    
    // Increase damage (damaged tiles received from customer)
    product.damage.boxes += totalDamageBoxes;
    product.damage.pieces += totalDamagePieces;
    
    // Normalize damage
    const damageNorm = normalizePieces(product.damage.pieces, product.piecesPerBox);
    product.damage.boxes += damageNorm.boxes;
    product.damage.pieces = damageNorm.pieces;
    
    // Update legacy quantity field
    const totalPieces = toTotalPieces(product.stock.boxes, product.stock.pieces, product.piecesPerBox);
    const salesTotal = toTotalPieces(product.sales.boxes, product.sales.pieces, product.piecesPerBox);
    const damageTotalPieces = toTotalPieces(product.damage.boxes, product.damage.pieces, product.piecesPerBox);
    product.quantity = totalPieces - salesTotal - damageTotalPieces;
    
    await product.save();
    
    // Record damaged tiles received from customer
    await DamagedInventory.create({
      productId: product._id,
      quantity: { boxes: totalDamageBoxes, pieces: totalDamagePieces },
      damageType: 'customer',
      notes,
      recordedBy: 'demo-user',
      description: notes,
      status: 'returned'
    });
    
    // Record both actions in history
    await StockHistory.create({
      productId: product._id,
      action: 'damage_customer',
      change: { 
        newTilesGiven: { boxes: totalNewBoxes, pieces: totalNewPieces },
        damagedTilesReceived: { boxes: totalDamageBoxes, pieces: totalDamagePieces }
      },
      previousSales: oldSales,
      newSales: product.sales,
      previousDamage: oldDamage,
      newDamage: product.damage,
      notes,
      damageType: 'customer',
      performedBy: 'demo-user'
    });
    
    res.json({ ok: true, product, message: 'Customer damage exchange recorded successfully' });
  } catch (err) {
    next(err);
  }
};

export const getProductHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const history = await StockHistory.find({ productId: req.params.id })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ ok: true, history });
  } catch (err) {
    next(err);
  }
};
    console.log("Histroy Product");


// Get damaged inventory for a product
export const getProductDamaged = async (req, res, next) => {
  try {
    const { damageType, status, page = 1, limit = 30 } = req.query;
    const filter = { productId: req.params.id };
    if (damageType) filter.damageType = damageType;
    if (status) filter.status = status;
    
    const damaged = await DamagedInventory.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    
    const total = await DamagedInventory.countDocuments(filter);
    
    res.json({ ok: true, damaged, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// Get all damaged inventory
export const getAllDamaged = async (req, res, next) => {
  try {
    const { damageType, status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (damageType) filter.damageType = damageType;
    if (status) filter.status = status;
    
        console.log("Damage Product List");

    const damaged = await DamagedInventory.find(filter)
      .populate('productId', 'productName category')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    
    const total = await DamagedInventory.countDocuments(filter);
    
    res.json({ ok: true, damaged, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// Update damaged inventory status
export const updateDamagedStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const damaged = await DamagedInventory.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!damaged) return res.status(404).json({ ok: false, message: 'Damaged record not found' });
    res.json({ ok: true, damaged, message: 'Status updated successfully' });
  } catch (err) {
    next(err);
  }
};

    console.log("Damage Product Update");


// Update low stock threshold for a single product
export const updateLowStockThreshold = async (req, res, next) => {
  try {
    const { lowStockThreshold } = req.body;
        console.log("Low Stock Product");

    if (lowStockThreshold === undefined || lowStockThreshold === null) {
      return res.status(400).json({ ok: false, message: 'Low stock threshold is required' });
    }
    
    if (lowStockThreshold < 0) {
      return res.status(400).json({ ok: false, message: 'Threshold must be 0 or greater' });
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { lowStockThreshold: Number(lowStockThreshold) },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }
    
    res.json({ 
      ok: true, 
      product, 
      message: 'Low stock threshold updated successfully' 
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update low stock threshold for multiple products
export const bulkUpdateLowStockThreshold = async (req, res, next) => {
  try {
    const { productIds, lowStockThreshold } = req.body;
        console.log("Low Stock  Product Bulk Update");

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'Product IDs array is required' });
    }
    
    if (lowStockThreshold === undefined || lowStockThreshold === null) {
      return res.status(400).json({ ok: false, message: 'Low stock threshold is required' });
    }
    
    if (lowStockThreshold < 0) {
      return res.status(400).json({ ok: false, message: 'Threshold must be 0 or greater' });
    }
    
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { lowStockThreshold: Number(lowStockThreshold) }
    );
    
    res.json({ 
      ok: true, 
      updatedCount: result.modifiedCount,
      message: `Updated threshold for ${result.modifiedCount} products` 
    });
  } catch (err) {
    next(err);
  }
};;

