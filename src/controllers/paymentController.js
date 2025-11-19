import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';

/**
 * Payment Controller
 * Handles payment tracking and history
 */

// Get all payments
export const getAllPayments = async (req, res) => {
  try {
    const {
      search,
      customerId,
      invoiceId,
      paymentMethod,
      startDate,
      endDate,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    let query = {};

    // Only show actual payments (not date extensions)
    query.amount = { $gt: 0 };

    // Filter by invoice
    if (invoiceId) {
      query.invoiceId = invoiceId;
    }

    // Filter by customer
    if (customerId) {
      query.customerId = customerId;
    }

    // Filter by payment method
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    // Search by payment number
    if (search) {
      query.paymentNumber = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(query)
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'name phone')
      .populate('invoiceId', 'invoiceNumber finalAmount');

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      count: payments.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      payments
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Get single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customerId', 'name phone email address')
      .populate('invoiceId', 'invoiceNumber finalAmount payment');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
};

// Get pending payments (with due dates)
export const getPendingPayments = async (req, res) => {
  try {
    const { overdueOnly, upcomingDays } = req.query;
    const today = new Date();

    let query = {
      'payment.status': { $in: ['PENDING', 'PARTIAL'] },
      'payment.nextDueDate': { $ne: null }
    };

    if (overdueOnly === 'true') {
      query['payment.nextDueDate'] = { $lt: today };
    } else if (upcomingDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(upcomingDays));
      query['payment.nextDueDate'] = {
        $gte: today,
        $lte: futureDate
      };
    }

    const invoices = await Invoice.find(query)
      .sort({ 'payment.nextDueDate': 1 })
      .populate('customerId', 'name phone email');

    // Categorize by overdue status
    const overdue = [];
    const upcoming = [];

    invoices.forEach(invoice => {
      if (new Date(invoice.payment.nextDueDate) < today) {
        overdue.push(invoice);
      } else {
        upcoming.push(invoice);
      }
    });

    res.json({
      success: true,
      overdue: {
        count: overdue.length,
        invoices: overdue
      },
      upcoming: {
        count: upcoming.length,
        invoices: upcoming
      },
      total: invoices.length
    });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending payments',
      error: error.message
    });
  }
};

// Get customer payment history
export const getCustomerPaymentHistory = async (req, res) => {
  try {
    const customerId = req.params.customerId;

    const payments = await Payment.find({ customerId })
      .sort({ createdAt: -1 })
      .populate('invoiceId', 'invoiceNumber finalAmount');

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      customer: {
        name: customer.name,
        totalPaidAmount: customer.totalPaidAmount,
        outstandingBalance: customer.outstandingBalance
      },
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error('Get customer payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message
    });
  }
};

// Delete payment (admin only)
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update invoice
    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice) {
      invoice.payment.totalPaid -= payment.amount;
      invoice.payment.pendingAmount += payment.amount;
      
      // Update payment status
      if (invoice.payment.totalPaid === 0) {
        invoice.payment.status = 'PENDING';
      } else if (invoice.payment.pendingAmount > 0) {
        invoice.payment.status = 'PARTIAL';
      }

      // Remove from payment history
      invoice.payment.paymentHistory = invoice.payment.paymentHistory.filter(
        p => p.paymentId?.toString() !== payment._id.toString()
      );

      await invoice.save();
    }

    // Update customer
    const customer = await Customer.findById(payment.customerId);
    if (customer) {
      customer.totalPaidAmount -= payment.amount;
      customer.outstandingBalance += payment.amount;
      await customer.save();
    }

    await payment.deleteOne();

    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment',
      error: error.message
    });
  }
};
