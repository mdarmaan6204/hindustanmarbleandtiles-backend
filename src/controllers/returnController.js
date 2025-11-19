import Return from '../models/Return.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import { toTotalPieces, normalizePieces } from '../utils/inventory.js';

/**
 * Return Controller
 * Handles customer returns, exchanges, and credit management
 */

// Create new return
export const createReturn = async (req, res) => {
  try {
    const {
      invoiceId,
      items,
      returnType,
      refundMethod,
      notes
    } = req.body;

    // Validate
    if (!invoiceId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice and items are required'
      });
    }

    // Get invoice
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Get customer
    const customer = await Customer.findById(invoice.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Calculate total return value
    let totalReturnValue = 0;
    const processedItems = [];

    for (const item of items) {
      // Find original item in invoice
      const invoiceItem = invoice.items.find(
        i => i.productId && i.productId.toString() === item.productId
      );

      if (!invoiceItem) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productName} not found in invoice`
        });
      }

      // Calculate return value
      const returnValue = item.returnValue || (
        (item.quantity.boxes * invoiceItem.pricePerBox) +
        (item.quantity.pieces * (invoiceItem.pricePerBox / invoiceItem.piecesPerBox))
      );

      totalReturnValue += returnValue;

      processedItems.push({
        productId: item.productId,
        productName: invoiceItem.productName,
        productType: invoiceItem.productType,
        productSize: invoiceItem.productSize,
        piecesPerBox: invoiceItem.piecesPerBox,
        quantity: item.quantity,
        originalPricePerBox: invoiceItem.pricePerBox,
        originalItemTotal: invoiceItem.itemTotal,
        returnValue: returnValue,
        returnReason: item.returnReason || 'OTHER',
        condition: item.condition || 'GOOD'
      });

      // Update stock - add to returns
      const product = await Product.findById(item.productId);
      if (product) {
        const currentReturns = toTotalPieces(
          product.returns?.boxes || 0,
          product.returns?.pieces || 0,
          product.piecesPerBox
        );

        const returnedPieces = toTotalPieces(
          item.quantity.boxes,
          item.quantity.pieces,
          product.piecesPerBox
        );

        const newReturnsPieces = currentReturns + returnedPieces;
        const newReturns = normalizePieces(newReturnsPieces, product.piecesPerBox);

        product.returns = {
          boxes: newReturns.boxes,
          pieces: newReturns.pieces
        };

        await product.save();

        // Calculate available stock after return
        const stockPieces = toTotalPieces(
          product.stock?.boxes || 0,
          product.stock?.pieces || 0,
          product.piecesPerBox
        );
        const salesPieces = toTotalPieces(
          product.sales?.boxes || 0,
          product.sales?.pieces || 0,
          product.piecesPerBox
        );
        const damagePieces = toTotalPieces(
          product.damage?.boxes || 0,
          product.damage?.pieces || 0,
          product.piecesPerBox
        );

        const availablePieces = Math.max(0, stockPieces - salesPieces - damagePieces + newReturnsPieces);
        const availableStock = normalizePieces(availablePieces, product.piecesPerBox);

        // Create stock history
        const stockHistory = new StockHistory({
          productId: product._id,
          action: 'RETURN',
          change: {
            boxes: item.quantity.boxes,
            pieces: item.quantity.pieces
          },
          quantity: {
            boxes: availableStock.boxes,
            pieces: availableStock.pieces
          },
          notes: `Customer return - Invoice #${invoice.invoiceNumber} - ${item.returnReason || 'Not specified'}`,
          invoiceId: invoice._id,
          customerId: customer._id
        });
        await stockHistory.save();
      }
    }

    // Create return record
    const returnRecord = new Return({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: customer._id,
      customerDetails: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address
      },
      items: processedItems,
      totalReturnValue,
      returnType: returnType || 'CREDIT',
      refundMethod: refundMethod || 'CASH',
      creditGenerated: returnType === 'CREDIT' ? totalReturnValue : 0,
      creditBalance: returnType === 'CREDIT' ? totalReturnValue : 0,
      refundAmount: returnType === 'REFUND' ? totalReturnValue : 0,
      notes: notes || '',
      status: 'APPROVED',
      stockAdjusted: true
    });

    await returnRecord.save();

    // Update invoice
    invoice.return.isReturned = true;
    invoice.return.returnDate = new Date();
    invoice.return.totalRefundAmount = (invoice.return.totalRefundAmount || 0) + totalReturnValue;
    
    if (returnType === 'CREDIT') {
      invoice.return.totalReturnCredit = (invoice.return.totalReturnCredit || 0) + totalReturnValue;
      invoice.return.availableReturnCredit = (invoice.return.availableReturnCredit || 0) + totalReturnValue;
    }

    // Add to returns history
    if (!invoice.return.returnsHistory) {
      invoice.return.returnsHistory = [];
    }
    invoice.return.returnsHistory.push({
      returnId: returnRecord._id,
      returnNumber: returnRecord.returnNumber,
      returnDate: new Date(),
      returnType: returnType || 'CREDIT',
      returnValue: totalReturnValue,
      items: processedItems.map(item => ({
        productName: item.productName,
        quantity: item.quantity
      }))
    });

    // Reduce outstanding balance by return value
    invoice.payment.pendingAmount = Math.max(0, invoice.payment.pendingAmount - totalReturnValue);
    
    // Update customer outstanding balance
    customer.outstandingBalance = Math.max(0, customer.outstandingBalance - totalReturnValue);
    
    await invoice.save();
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Return processed successfully',
      return: returnRecord
    });

  } catch (error) {
    console.error('Create return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process return',
      error: error.message
    });
  }
};

// Get all returns
export const getAllReturns = async (req, res) => {
  try {
    const { search, status, startDate, endDate, customerId } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const returns = await Return.find(query)
      .sort({ createdAt: -1 })
      .populate('invoiceId', 'invoiceNumber finalAmount')
      .populate('customerId', 'name phone');

    res.json({
      success: true,
      count: returns.length,
      returns
    });
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns',
      error: error.message
    });
  }
};

// Get single return
export const getReturnById = async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id)
      .populate('invoiceId')
      .populate('customerId');

    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    res.json({
      success: true,
      return: returnRecord
    });
  } catch (error) {
    console.error('Get return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return',
      error: error.message
    });
  }
};

// Get customer's available credit
export const getCustomerCredit = async (req, res) => {
  try {
    const { customerId } = req.params;

    const returns = await Return.find({
      customerId,
      returnType: 'CREDIT',
      creditBalance: { $gt: 0 }
    });

    const totalCredit = returns.reduce((sum, ret) => sum + ret.creditBalance, 0);

    res.json({
      success: true,
      totalCredit,
      returns
    });
  } catch (error) {
    console.error('Get customer credit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer credit',
      error: error.message
    });
  }
};

// Use credit in new invoice
export const useCredit = async (req, res) => {
  try {
    const { customerId, invoiceId, creditAmount } = req.body;

    if (!customerId || !invoiceId || !creditAmount || creditAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters'
      });
    }

    // Get available credits
    const returns = await Return.find({
      customerId,
      returnType: 'CREDIT',
      creditBalance: { $gt: 0 }
    }).sort({ createdAt: 1 }); // Use oldest credit first

    const totalAvailable = returns.reduce((sum, ret) => sum + ret.creditBalance, 0);

    if (totalAvailable < creditAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credit. Available: ₹${totalAvailable}`
      });
    }

    // Deduct credit from returns (FIFO)
    let remaining = creditAmount;
    for (const returnRecord of returns) {
      if (remaining <= 0) break;

      const deduction = Math.min(remaining, returnRecord.creditBalance);
      returnRecord.creditUsed += deduction;
      returnRecord.creditBalance -= deduction;
      await returnRecord.save();

      remaining -= deduction;
    }

    res.json({
      success: true,
      message: 'Credit applied successfully',
      creditUsed: creditAmount
    });

  } catch (error) {
    console.error('Use credit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to use credit',
      error: error.message
    });
  }
};

export default {
  createReturn,
  getAllReturns,
  getReturnById,
  getCustomerCredit,
  useCredit
};
