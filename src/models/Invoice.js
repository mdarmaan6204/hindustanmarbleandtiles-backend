import mongoose from 'mongoose';

/**
 * Invoice Schema
 * Handles both GST and Non-GST invoices
 * Tracks payment status, returns, and links to stock history
 */

const invoiceSchema = new mongoose.Schema({
  // Invoice identification
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true  // Allow null/undefined before pre-save generates it
  },
  invoiceType: {
    type: String,
    enum: ['GST', 'NON_GST'],
    required: true,
    default: 'NON_GST'
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Customer details
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerDetails: {
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    gstNumber: { type: String, default: '' }
  },
  
  // Sales channel
  salesChannel: {
    type: String,
    enum: ['OFFLINE', 'ONLINE'],
    required: true,
    default: 'OFFLINE'
  },
  
  // Invoice items
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false  // Optional for custom products
    },
    productName: { type: String, required: true },
    productType: { type: String },
    productSize: { type: String },
    hsnNo: { type: String, default: '' }, // HSN code for GST invoices
    isCustom: { type: Boolean, default: false }, // Flag for custom products
    
    quantity: {
      boxes: { type: Number, default: 0 },
      pieces: { type: Number, default: 0 }
    },
    piecesPerBox: { type: Number, required: true },
    
    // Pricing
    pricePerBox: { type: Number, default: 0 },
    pricePerPiece: { type: Number, default: 0 },
    itemTotal: { type: Number, required: true },
    
    // Tax (for GST invoices)
    taxRate: { type: Number, default: 0 }, // 0, 5, 12, 18, 28
    taxAmount: { type: Number, default: 0 },
    
    // Link to stock history
    stockHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockHistory'
    }
  }],
  
  // Financial calculations
  subtotal: {
    type: Number,
    required: true
  },
  
  // Discount (flat amount)
  discount: {
    type: Number,
    default: 0
  },
  
  // Tax calculations (for GST invoices)
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  
  // Invoice Value (for display) - subtotal + tax (before discount)
  invoiceValue: {
    type: Number,
    required: true
  },
  
  // Total amount before discount (for calculations)
  totalBeforeDiscount: {
    type: Number,
    required: true
  },
  
  // Final amount
  totalAmount: {
    type: Number,
    required: true
  },
  roundOffAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  
  // Payment tracking
  payment: {
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'PARTIAL', 'OVERDUE'],
      default: 'PENDING'
    },
    totalPaid: {
      type: Number,
      default: 0
    },
    pendingAmount: {
      type: Number,
      default: 0
    },
    nextDueDate: {
      type: Date,
      default: null
    },
    paymentHistory: [{
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
      },
      amount: Number,
      date: Date,
      method: String
    }]
  },
  
  // Return tracking
  return: {
    isReturned: {
      type: Boolean,
      default: false
    },
    returnDate: {
      type: Date,
      default: null
    },
    returnedItems: [{
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      quantity: {
        boxes: Number,
        pieces: Number
      },
      refundAmount: Number,
      returnReason: String,
      stockHistoryId: mongoose.Schema.Types.ObjectId
    }],
    totalRefundAmount: {
      type: Number,
      default: 0
    },
    // Return Credit Management
    totalReturnCredit: {
      type: Number,
      default: 0
    },
    usedReturnCredit: {
      type: Number,
      default: 0
    },
    availableReturnCredit: {
      type: Number,
      default: 0
    },
    returnNotes: {
      type: String,
      default: ''
    },
    // Returns History
    returnsHistory: [{
      returnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Return'
      },
      returnNumber: String,
      returnDate: Date,
      returnType: String, // CREDIT, REFUND, EXCHANGE
      returnValue: Number,
      items: [{
        productName: String,
        quantity: {
          boxes: Number,
          pieces: Number
        }
      }]
    }]
  },
  
  // Invoice status
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'RETURNED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  
  // Additional info
  notes: {
    type: String,
    default: ''
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ 'payment.status': 1 });
invoiceSchema.index({ 'payment.nextDueDate': 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ salesChannel: 1 });
invoiceSchema.index({ invoiceType: 1 });

// Auto-generate invoice number
invoiceSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.invoiceNumber) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const prefix = this.invoiceType === 'GST' ? 'GST' : 'INV';
      
      // Find last invoice number for this type and year-month
      const Invoice = mongoose.models.Invoice || mongoose.model('Invoice');
      const lastInvoice = await Invoice
        .findOne({ 
          invoiceType: this.invoiceType,
          invoiceNumber: new RegExp(`^${prefix}-${year}${month}-`)
        })
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber')
        .lean();
      
      let sequence = 1;
      if (lastInvoice && lastInvoice.invoiceNumber) {
        const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop()) || 0;
        sequence = lastSeq + 1;
      }
      
      this.invoiceNumber = `${prefix}-${year}${month}-${String(sequence).padStart(4, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model('Invoice', invoiceSchema);
