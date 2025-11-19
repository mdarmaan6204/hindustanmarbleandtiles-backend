import mongoose from 'mongoose';

const stockHistorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  date: { type: Date, default: Date.now },
  action: { type: String, required: true }, // add | sell | adjust | return | damage_shop | damage_customer | exchange
  
  // Dual-unit change tracking
  change: {
    boxes: { type: Number, default: 0 },
    pieces: { type: Number, default: 0 }
  },
  
  // Current stock quantity after change
  quantity: {
    boxes: { type: Number },
    pieces: { type: Number }
  },
  
  // Legacy fields (for backward compatibility)
  previousQuantity: { type: Number },
  newQuantity: { type: Number },
  unit: { type: String },
  
  notes: { type: String }, // System-generated notes
  description: { type: String }, // User-provided description
  performedBy: { type: String, default: 'demo-user' }, // Store as string for demo mode
  
  // Damage-specific fields
  damageType: { type: String }, // own | customer-refund | exchange-same | exchange-different
  damageReason: { type: String }, // Broken | Chipped | Manufacturing Defect | Other
  customerName: { type: String }, // For customer damage cases
  
  // Exchange reference (for linking exchange transactions)
  relatedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // For exchange-different
  relatedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockHistory' }, // Link to paired transaction
  
  // Sales & Invoice linking
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }, // Link to invoice for sale/return transactions
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // Link to customer
  
  damagedQuantity: { type: Number }, // Quantity moved to damaged inventory (legacy)
}, { timestamps: true });

export default mongoose.model('StockHistory', stockHistorySchema);
