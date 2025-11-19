import mongoose from 'mongoose';

const damagedInventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 0 },
  damageType: { type: String, enum: ['shop', 'customer'], required: true },
  date: { type: Date, default: Date.now },
  notes: { type: String },
  recordedBy: { type: String, default: 'demo-user' },
  status: { type: String, enum: ['pending', 'disposed', 'repaired', 'returned'], default: 'pending' },
  description: { type: String }, // Detailed description of damage
}, { timestamps: true });

export default mongoose.model('DamagedInventory', damagedInventorySchema);
