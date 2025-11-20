import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'staff', 'stock-viewer'],
    default: 'admin' 
  },
  permissions: {
    canViewStock: { type: Boolean, default: true },
    canViewSales: { type: Boolean, default: true },
    canViewCustomers: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true },
    canViewPayments: { type: Boolean, default: true },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
