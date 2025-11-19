import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';

/**
 * Customer Controller
 * Handles all customer-related operations
 */

// Get all customers
export const getAllCustomers = async (req, res) => {
  try {
    const { search, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const customers = await Customer.find(query)
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 });

    // Calculate total discount for each customer from their invoices
    const Invoice = (await import('../models/Invoice.js')).default;
    const customersWithDiscount = await Promise.all(
      customers.map(async (customer) => {
        const invoices = await Invoice.find({ customerId: customer._id });
        const totalDiscount = invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
        
        return {
          ...customer.toObject(),
          totalDiscountGiven: totalDiscount
        };
      })
    );

    res.json({
      success: true,
      count: customersWithDiscount.length,
      customers: customersWithDiscount
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

// Get single customer by ID
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Calculate available credit from returns
    const Return = (await import('../models/Return.js')).default;
    const returns = await Return.find({ 
      customerId: req.params.id,
      status: { $in: ['APPROVED', 'COMPLETED'] }
    });

    const availableCredit = returns.reduce((total, returnDoc) => {
      return total + (returnDoc.creditBalance || 0);
    }, 0);

    res.json({
      success: true,
      customer: {
        ...customer.toObject(),
        availableCredit
      }
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error.message
    });
  }
};

// Create new customer
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, gstNumber } = req.body;

    // Validation - only name is required
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Check if phone already exists (only if phone is provided)
    if (phone) {
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this phone number already exists'
        });
      }
    }

    const customer = new Customer({
      name,
      phone: phone || '',
      email,
      address,
      gstNumber
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, gstNumber } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if phone is being changed and if it already exists
    if (phone && phone !== customer.phone) {
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this phone number already exists'
        });
      }
    }

    // Update fields
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (email !== undefined) customer.email = email;
    if (address !== undefined) customer.address = address;
    if (gstNumber !== undefined) customer.gstNumber = gstNumber;

    await customer.save();

    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has any invoices
    const invoiceCount = await Invoice.countDocuments({ customerId: customer._id });
    
    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing invoices'
      });
    }

    await customer.deleteOne();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

// Get customer statistics
export const getCustomerStats = async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const Invoice = require('../models/Invoice');
    const Payment = require('../models/Payment');

    // Get all invoices
    const invoices = await Invoice.find({ customerId })
      .sort({ createdAt: -1 });

    // Get all payments
    const payments = await Payment.find({ customerId })
      .sort({ createdAt: -1 });

    // Calculate stats
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.payment.status === 'PAID').length;
    const pendingInvoices = invoices.filter(inv => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inv.payment.status)).length;

    res.json({
      success: true,
      customer,
      stats: {
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        totalPurchaseAmount: customer.totalPurchaseAmount,
        totalPaidAmount: customer.totalPaidAmount,
        outstandingBalance: customer.outstandingBalance,
        lastPurchaseDate: customer.lastPurchaseDate
      },
      recentInvoices: invoices.slice(0, 5),
      recentPayments: payments.slice(0, 5)
    });
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer statistics',
      error: error.message
    });
  }
};
