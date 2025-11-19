import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // ===== PRODUCT IDENTIFICATION =====
  productName: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true }, // Optional unique SKU
  description: { type: String },
  
  // ===== PRODUCT CLASSIFICATION =====
  type: { type: String, required: true }, // Floor, Wall, Parking, Other
  subType: { type: String }, // Glossy, Matte, High Glossy, Rough (Only for Floor type)
  size: { type: String, required: true }, // 1×1, 1×1.5, 1×2, 2×2, 2×4, 16×16
  
  // ===== PIECES PER BOX CONFIGURATION =====
  piecesPerBox: { type: Number, required: true }, // e.g., 4 for 2×2, 6 for 1×1.5
  // For 1×2, this locks the user's choice (5 or 6)
  
  // ===== DUAL-UNIT INVENTORY TRACKING =====
  // All quantities stored as {boxes: Number, pieces: Number}
  stock: {
    boxes: { type: Number, default: 0 },
    pieces: { type: Number, default: 0 }
  },
  
  sales: {
    boxes: { type: Number, default: 0 },
    pieces: { type: Number, default: 0 }
  },
  
  damage: {
    boxes: { type: Number, default: 0 },
    pieces: { type: Number, default: 0 }
  },
  
  returns: {
    boxes: { type: Number, default: 0 },
    pieces: { type: Number, default: 0 }
  },
  
  // ===== LEGACY FIELDS (DEPRECATED - kept for backward compatibility) =====
  quantity: { type: Number, default: 0 },
  hsnNo: { type: String },
  brand: { type: String, default: 'Varmora' },
  application: { type: String },
  location: { type: String },
  unit: { type: String, enum: ['Box', 'Sq.Ft', 'Pieces'], default: 'Box' },
  price: { type: Number, default: 0 },
  pricePerUnit: { type: Number, default: 0 },
  
  // ===== MEDIA & LINKS =====
  images: [{ type: String }], // Array of image URLs (first is main image)
  link3D: { type: String }, // Link to 3D preview
  
  // ===== SUPPLIER & COST INFORMATION =====
  supplier: { type: String, default: 'Varmora' },
  costPerBox: { type: Number, default: 0 }, // Purchase cost in rupees
  lastCostUpdate: { type: Date },
  
  // ===== STATUS & METADATA =====
  lowStockThreshold: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

// Indexes for performance
productSchema.index({ productName: 1 });
productSchema.index({ size: 1 });
productSchema.index({ type: 1 });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 });

export default mongoose.model('Product', productSchema);
