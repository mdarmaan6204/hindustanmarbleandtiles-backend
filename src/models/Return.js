import mongoose from 'mongoose';

/**
 * Return Schema
 * Handles customer returns, exchanges, and credit management
 * Tracks: Invoice-linked returns, credit notes, stock adjustments
 */

const returnSchema = new mongoose.Schema({
  returnNumber: {
    type: String,
    unique: true
    // Remove 'required: true' - will be auto-generated
  },
  
  // Linking
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerDetails: {
    name: String,
    phone: String,
    address: String
  },
  
  // Return Items
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    productType: String,
    productSize: String,
    piecesPerBox: Number,
    quantity: {
      boxes: { type: Number, default: 0 },
      pieces: { type: Number, default: 0 }
    },
    // Original invoice values
    originalPricePerBox: Number,
    originalItemTotal: Number,
    // Return value (might be different if partial return or adjustment)
    returnValue: Number,
    returnReason: {
      type: String,
      enum: ['DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'CUSTOMER_REQUEST', 'EXCHANGE', 'OTHER'],
      default: 'OTHER'
    },
    condition: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'DEFECTIVE'],
      default: 'GOOD'
    }
  }],
  
  // Financial Details
  totalReturnValue: {
    type: Number,
    required: true,
    default: 0
  },
  
  returnType: {
    type: String,
    enum: ['CREDIT', 'REFUND', 'EXCHANGE'],
    default: 'CREDIT'
  },
  
  // Credit Management
  creditGenerated: {
    type: Number,
    default: 0
  },
  creditUsed: {
    type: Number,
    default: 0
  },
  creditBalance: {
    type: Number,
    default: 0
  },
  
  // Refund Details (if returnType = REFUND)
  refundAmount: {
    type: Number,
    default: 0
  },
  refundMethod: {
    type: String,
    enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE'],
    default: 'CASH'
  },
  refundDate: Date,
  
  // Exchange Details (if returnType = EXCHANGE)
  exchangeInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  exchangeInvoiceNumber: String,
  exchangeItems: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    productType: String,
    productSize: String,
    piecesPerBox: Number,
    quantity: {
      boxes: { type: Number, default: 0 },
      pieces: { type: Number, default: 0 }
    },
    pricePerBox: Number,
    itemTotal: Number
  }],
  exchangeDifference: {
    type: Number,
    default: 0 // Positive = customer pays extra, Negative = customer gets credit
  },
  
  // Status
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    default: 'APPROVED'
  },
  
  // Additional Info
  notes: String,
  internalNotes: String,
  processedBy: {
    type: String,
    default: 'demo-user'
  },
  approvedBy: String,
  approvedDate: Date,
  
  // Stock adjustment tracking
  stockAdjusted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate return number before validation
returnSchema.pre('validate', async function(next) {
  try {
    if (this.isNew && !this.returnNumber) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // Find last return number for this month
      const lastReturn = await this.constructor
        .findOne({ 
          returnNumber: new RegExp(`^RET-${year}${month}-`)
        })
        .sort({ returnNumber: -1 })
        .select('returnNumber')
        .lean();
      
      let sequence = 1;
      if (lastReturn && lastReturn.returnNumber) {
        const lastSeq = parseInt(lastReturn.returnNumber.split('-').pop()) || 0;
        sequence = lastSeq + 1;
      }
      
      this.returnNumber = `RET-${year}${month}-${String(sequence).padStart(4, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Indexes
returnSchema.index({ returnNumber: 1 });
returnSchema.index({ invoiceId: 1 });
returnSchema.index({ customerId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

export default mongoose.model('Return', returnSchema);
