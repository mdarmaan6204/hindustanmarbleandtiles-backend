import mongoose from 'mongoose';

/**
 * Customer Schema
 * Stores customer information and tracks outstanding balance
 */

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  gstNumber: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Financial tracking
  totalPurchaseAmount: {
    type: Number,
    default: 0
  },
  totalPaidAmount: {
    type: Number,
    default: 0
  },
  outstandingBalance: {
    type: Number,
    default: 0
  },
  
  // Statistics
  totalInvoices: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: {
    type: Date,
    default: null
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries
customerSchema.index({ phone: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ outstandingBalance: 1 });
customerSchema.index({ isActive: 1 });

export default mongoose.model('Customer', customerSchema);
