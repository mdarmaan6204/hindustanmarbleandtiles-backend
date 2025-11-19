import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import Payment from '../models/Payment.js';
import { toTotalPieces, normalizePieces } from '../utils/inventory.js';

/**
 * Invoice Controller
 * Handles invoice creation, updates, and stock management
 */

// Helper function to calculate payment status
const calculatePaymentStatus = (totalPaid, finalAmount) => {
  if (totalPaid >= finalAmount) {
    return 'PAID';
  } else if (totalPaid > 0) {
    return 'PARTIAL';
  } else {
    return 'PENDING';
  }
};

// Create new invoice
export const createInvoice = async (req, res) => {
  try {
    const {
      invoiceType,
      invoiceDate,
      salesChannel,
      customerId,
      customerDetails,
      items,
      subtotal,
      discount,
      cgst,
      sgst,
      totalTax,
      totalAmount,
      roundOffAmount,
      finalAmount,
      payment,
      notes,
      customInvoiceNumber
    } = req.body;

    // Validation
    if (!customerId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer and items are required'
      });
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Validate stock availability and prepare stock updates
    const stockUpdates = [];
    for (const item of items) {
      // Skip custom products (products not in database)
      if (!item.productId || item.isCustom) {
        console.log(`Skipping stock update for custom product: ${item.productName}`);
        continue;
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`Product not found in database: ${item.productName} (${item.productId})`);
        continue; // Skip instead of blocking invoice creation
      }

      // Calculate total pieces needed
      const requestedPieces = toTotalPieces(
        item.quantity.boxes,
        item.quantity.pieces,
        product.piecesPerBox
      );

      // Calculate available stock
      const availablePieces = toTotalPieces(
        product.stock.boxes,
        product.stock.pieces,
        product.piecesPerBox
      );

      // Warn if insufficient stock (but don't block)
      if (requestedPieces > availablePieces) {
        console.warn(`Warning: Insufficient stock for ${product.productName}. Requested: ${requestedPieces}, Available: ${availablePieces}`);
      }

      stockUpdates.push({
        product,
        requestedPieces,
        quantity: item.quantity
      });
    }

    // Create invoice
    const invoiceData = {
      invoiceType: invoiceType || 'NON_GST',
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      salesChannel: salesChannel || 'OFFLINE',
      customerId,
      customerDetails: {
        name: customerDetails.name || customer.name,
        phone: customerDetails.phone || customer.phone,
        address: customerDetails.address || customer.address || '',
        gstNumber: customerDetails.gstNumber || customer.gstNumber || ''
      },
      items,
      subtotal,
      discount: discount || 0,
      cgst: cgst || 0,
      sgst: sgst || 0,
      igst: 0, // Add IGST if needed
      totalTax: totalTax || 0,
      // Calculate totalBeforeDiscount = subtotal + totalTax
      totalBeforeDiscount: (subtotal || 0) + (totalTax || 0),
      // Calculate invoiceValue based on invoice type
      // For GST: invoiceValue = totalBeforeDiscount
      // For NON_GST: invoiceValue = subtotal
      invoiceValue: (invoiceType === 'GST') ? ((subtotal || 0) + (totalTax || 0)) : (subtotal || 0),
      totalAmount,
      roundOffAmount: roundOffAmount || 0,
      finalAmount,
      payment: {
        status: calculatePaymentStatus(payment?.totalPaid || 0, finalAmount),
        totalPaid: payment?.totalPaid || 0,
        pendingAmount: finalAmount - (payment?.totalPaid || 0), // Calculate pending as finalAmount - totalPaid
        nextDueDate: payment?.nextDueDate || null
      },
      notes: notes || ''
    };

    // Add custom invoice number if provided
    if (customInvoiceNumber && customInvoiceNumber.trim()) {
      invoiceData.invoiceNumber = customInvoiceNumber.trim();
    }

    const invoice = new Invoice(invoiceData);

    await invoice.save();

    // Update stock for each product
    for (const update of stockUpdates) {
      const { product, requestedPieces, quantity } = update;

      // For SALES: Update sales field, NOT stock field
      // Availability = stock - sales - damage + returns (auto-calculated)
      const currentSalesPieces = toTotalPieces(
        product.sales?.boxes || 0,
        product.sales?.pieces || 0,
        product.piecesPerBox
      );
      const newSalesPieces = currentSalesPieces + requestedPieces;
      const newSales = normalizePieces(newSalesPieces, product.piecesPerBox);

      // Update product sales (not stock!)
      product.sales = {
        boxes: newSales.boxes,
        pieces: newSales.pieces
      };
      await product.save();

      // Calculate available stock after this sale for history record
      const stockPieces = toTotalPieces(
        product.stock.boxes,
        product.stock.pieces,
        product.piecesPerBox
      );
      const damagePieces = toTotalPieces(
        product.damage?.boxes || 0,
        product.damage?.pieces || 0,
        product.piecesPerBox
      );
      const returnsPieces = toTotalPieces(
        product.returns?.boxes || 0,
        product.returns?.pieces || 0,
        product.piecesPerBox
      );
      const availablePieces = stockPieces - newSalesPieces - damagePieces + returnsPieces;
      const availableStock = normalizePieces(Math.max(0, availablePieces), product.piecesPerBox);

      // Create stock history entry
      const stockHistory = new StockHistory({
        productId: product._id,
        action: 'SALE',
        change: {
          boxes: quantity.boxes,
          pieces: quantity.pieces
        },
        quantity: {
          boxes: availableStock.boxes,
          pieces: availableStock.pieces
        },
        notes: `Sale - Invoice: ${invoice.invoiceNumber}`,
        invoiceId: invoice._id,
        customerId: customer._id
      });
      await stockHistory.save();
    }

    // Update customer statistics
    customer.totalPurchaseAmount += finalAmount;
    customer.totalPaidAmount += (payment?.totalPaid || 0);
    customer.outstandingBalance += (payment?.pendingAmount || finalAmount);
    customer.totalInvoices += 1;
    customer.lastPurchaseDate = new Date();
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
};

// Get all invoices
export const getAllInvoices = async (req, res) => {
  try {
    const {
      search,
      invoiceType,
      paymentStatus,
      salesChannel,
      customerId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    let query = {};

    // Filter by customer
    if (customerId) {
      query.customerId = customerId;
    }

    // Search by invoice number or customer name
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by invoice type
    if (invoiceType) {
      query.invoiceType = invoiceType;
    }

    // Filter by payment status (supports comma-separated values)
    if (paymentStatus) {
      const statuses = paymentStatus.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        query['payment.status'] = { $in: statuses };
      } else {
        query['payment.status'] = paymentStatus;
      }
    }

    // Filter by sales channel
    if (salesChannel) {
      query.salesChannel = salesChannel;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(query)
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'name phone email');

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      count: invoices.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};

// Get single invoice by ID
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customerId', 'name phone email address gstNumber');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
};

// Get invoice by invoice number
export const getInvoiceByNumber = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber })
      .populate('customerId', 'name phone email address gstNumber');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
};

// Update invoice payment
export const updateInvoicePayment = async (req, res) => {
  try {
    const { paymentAmount, paymentMethod, paymentDate, nextDueDate, transactionId, notes, discount } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Handle discount if provided (when marking as paid with discount)
    // Note: Discount does NOT change finalAmount - it's tracked separately
    if (discount && discount > 0) {
      invoice.discount = (invoice.discount || 0) + discount;
      // DO NOT change finalAmount - it stays as the original invoice amount
    }

    // Calculate actual pending amount considering discount
    const actualPendingAmount = invoice.finalAmount - invoice.payment.totalPaid - (invoice.discount || 0);

    // Only create payment record if amount > 0
    let payment = null;
    if (paymentAmount > 0) {
      payment = new Payment({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerDetails.name,
        amount: paymentAmount,
        paymentMethod: paymentMethod || 'CASH',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        transactionId: transactionId || '',
        nextDueDate: nextDueDate || null,
        notes: notes || `Payment for invoice ${invoice.invoiceNumber}`,
        remainingAmount: actualPendingAmount - paymentAmount
      });
      await payment.save();

      // Update invoice payment details
      invoice.payment.totalPaid += paymentAmount;
      invoice.payment.pendingAmount = invoice.finalAmount - invoice.payment.totalPaid - (invoice.discount || 0);
      
      if (invoice.payment.pendingAmount <= 0) {
        invoice.payment.status = 'PAID';
        invoice.payment.nextDueDate = null;
      } else if (invoice.payment.totalPaid > 0) {
        invoice.payment.status = 'PARTIAL';
        if (nextDueDate) {
          invoice.payment.nextDueDate = nextDueDate;
        }
      }

      // Add to payment history
      invoice.payment.paymentHistory.push({
        amount: paymentAmount,
        paymentMethod: paymentMethod || 'CASH',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentId: payment._id
      });

      // Update customer balance (considering discount)
      const customer = await Customer.findById(invoice.customerId);
      if (customer) {
        customer.totalPaidAmount += paymentAmount;
        // When discount is given, also reduce outstanding by discount amount
        customer.outstandingBalance -= (paymentAmount + (discount || 0));
        await customer.save();
      }
    } else {
      // Just update due date if no payment
      if (nextDueDate) {
        invoice.payment.nextDueDate = nextDueDate;
      }
      
      // If only discount is given (no payment), update customer balance
      if (discount && discount > 0) {
        const customer = await Customer.findById(invoice.customerId);
        if (customer) {
          customer.outstandingBalance -= discount;
          await customer.save();
        }
        
        // Update invoice pending amount
        invoice.payment.pendingAmount = invoice.finalAmount - invoice.payment.totalPaid - (invoice.discount || 0);
        if (invoice.payment.pendingAmount <= 0) {
          invoice.payment.status = 'PAID';
          invoice.payment.nextDueDate = null;
        }
      }
    }

    await invoice.save();

    res.json({
      success: true,
      message: 'Payment updated successfully',
      invoice,
      payment
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment',
      error: error.message
    });
  }
};

// Delete invoice (admin only - careful operation)
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Delete all stock history entries for this invoice
    await StockHistory.deleteMany({ invoiceId: invoice._id });

    // Restore sales for each item (reduce sales count)
    for (const item of invoice.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const currentSalesPieces = toTotalPieces(
          product.sales?.boxes || 0,
          product.sales?.pieces || 0,
          product.piecesPerBox
        );
        const returnPieces = toTotalPieces(
          item.quantity.boxes,
          item.quantity.pieces,
          product.piecesPerBox
        );
        const newSalesPieces = Math.max(0, currentSalesPieces - returnPieces);
        const newSales = normalizePieces(newSalesPieces, product.piecesPerBox);

        product.sales = {
          boxes: newSales.boxes,
          pieces: newSales.pieces
        };
        await product.save();
      }
    }

    // Update customer statistics
    const customer = await Customer.findById(invoice.customerId);
    if (customer) {
      customer.totalPurchaseAmount -= invoice.finalAmount;
      customer.totalPaidAmount -= invoice.payment.totalPaid;
      customer.outstandingBalance -= invoice.payment.pendingAmount;
      customer.totalInvoices = Math.max(0, customer.totalInvoices - 1);
      await customer.save();
    }

    // Delete related payments
    await Payment.deleteMany({ invoiceId: invoice._id });

    // Delete invoice
    await invoice.deleteOne();

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: error.message
    });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisYear = new Date(today.getFullYear(), 0, 1);

    // Today's stats
    const todayInvoices = await Invoice.countDocuments({
      createdAt: { $gte: today }
    });
    const todaySales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    // This month's stats
    const monthInvoices = await Invoice.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    const monthSales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    // Pending payments
    const pendingInvoices = await Invoice.countDocuments({
      'payment.status': { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    });
    const pendingAmount = await Invoice.aggregate([
      { $match: { 'payment.status': { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } },
      { $group: { _id: null, total: { $sum: '$payment.pendingAmount' } } }
    ]);

    // Total customers
    const totalCustomers = await Customer.countDocuments();

    res.json({
      success: true,
      stats: {
        today: {
          invoices: todayInvoices,
          sales: todaySales[0]?.total || 0
        },
        thisMonth: {
          invoices: monthInvoices,
          sales: monthSales[0]?.total || 0
        },
        pending: {
          invoices: pendingInvoices,
          amount: pendingAmount[0]?.total || 0
        },
        totalCustomers
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Update existing invoice
export const updateInvoice = async (req, res) => {
  try {
    const {
      invoiceType,
      invoiceDate,
      items,
      subtotal,
      discount,
      cgst,
      sgst,
      totalTax,
      totalAmount,
      roundOff,
      finalAmount,
      invoiceNotes,
      customerId
    } = req.body;

    // Find current invoice to get totalPaid and original items
    const currentInvoice = await Invoice.findById(req.params.id);
    if (!currentInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // ===== STOCK ADJUSTMENT LOGIC =====
    // When editing an invoice, we need to:
    // 1. Reverse the original sales quantities from ALL products
    // 2. Add the new sales quantities
    // 3. Update StockHistory with the NEW final quantities only

    // Step 1: Reverse original sales quantities
    for (const oldItem of currentInvoice.items) {
      const product = await Product.findById(oldItem.productId);
      if (product) {
        // Remove the old quantity from sales
        product.sales.boxes -= (oldItem.quantity?.boxes || 0);
        product.sales.pieces -= (oldItem.quantity?.pieces || 0);
        await product.save();
      }
    }

    // Step 2: Delete all old stock history entries for this invoice
    await StockHistory.deleteMany({
      invoiceId: req.params.id
    });

    // Step 3: Add new sales quantities and create fresh history entries
    for (const newItem of items) {
      const product = await Product.findById(newItem.productId);
      if (product) {
        const newBoxes = newItem.quantity?.boxes || 0;
        const newPieces = newItem.quantity?.pieces || 0;

        // Add the new quantity to sales
        product.sales.boxes += newBoxes;
        product.sales.pieces += newPieces;
        await product.save();

        // Calculate current available stock
        const piecesPerBox = product.piecesPerBox || 1;
        const stockPieces = (product.stock?.boxes || 0) * piecesPerBox + (product.stock?.pieces || 0);
        const salesPieces = (product.sales?.boxes || 0) * piecesPerBox + (product.sales?.pieces || 0);
        const damagePieces = (product.damage?.boxes || 0) * piecesPerBox + (product.damage?.pieces || 0);
        const returnsPieces = (product.returns?.boxes || 0) * piecesPerBox + (product.returns?.pieces || 0);
        const availablePieces = Math.max(0, stockPieces - salesPieces - damagePieces + returnsPieces);
        
        const availableBoxes = Math.floor(availablePieces / piecesPerBox);
        const availablePcs = availablePieces % piecesPerBox;

        // Create a SINGLE history entry with the final quantities
        await StockHistory.create({
          productId: newItem.productId,
          action: 'SALE',
          change: {
            boxes: newBoxes,
            pieces: newPieces
          },
          quantity: {
            boxes: availableBoxes,
            pieces: availablePcs
          },
          notes: `Sale - Invoice: ${currentInvoice.invoiceNumber}${currentInvoice.invoiceNumber !== req.body.invoiceNumber ? ' (Edited)' : ''}`,
          invoiceId: req.params.id,
          customerId
        });
      }
    }

    // Calculate pending amount based on new finalAmount and current totalPaid
    const totalPaid = currentInvoice.payment.totalPaid;
    const pendingAmount = Math.max(0, finalAmount - totalPaid);
    const paymentStatus = calculatePaymentStatus(totalPaid, finalAmount);

    // Update invoice with recalculated payment data
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        invoiceType,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        items,
        subtotal,
        discount,
        cgst: cgst || 0,
        sgst: sgst || 0,
        igst: 0,
        totalTax: totalTax || 0,
        // Recalculate totalBeforeDiscount and invoiceValue
        totalBeforeDiscount: (subtotal || 0) + (totalTax || 0),
        invoiceValue: (invoiceType === 'GST') ? ((subtotal || 0) + (totalTax || 0)) : (subtotal || 0),
        totalAmount,
        roundOffAmount: roundOff,
        finalAmount,
        invoiceNotes,
        customerId,
        'payment.pendingAmount': pendingAmount,
        'payment.status': paymentStatus,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('customerId');

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message
    });
  }
};

// Helper function to calculate invoiceValue based on type
const calculateInvoiceValue = (subtotal, totalTax, invoiceType) => {
  if (invoiceType === 'GST') {
    return subtotal + totalTax;
  } else {
    return subtotal;
  }
};

// Migration: Add totalBeforeDiscount and invoiceValue to all existing invoices
export const migrateInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      $or: [
        { totalBeforeDiscount: { $exists: false } },
        { invoiceValue: { $exists: false } }
      ]
    });

    let updated = 0;
    for (const invoice of invoices) {
      const totalBeforeDiscount = (invoice.subtotal || 0) + (invoice.totalTax || 0);
      const invoiceValue = calculateInvoiceValue(
        invoice.subtotal || 0,
        invoice.totalTax || 0,
        invoice.invoiceType
      );

      await Invoice.findByIdAndUpdate(
        invoice._id,
        {
          totalBeforeDiscount,
          invoiceValue
        }
      );
      updated++;
    }

    res.json({
      success: true,
      message: `Migration completed. Updated ${updated} invoices.`,
      updatedCount: updated
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
};
