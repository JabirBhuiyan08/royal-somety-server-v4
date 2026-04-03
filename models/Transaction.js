// server/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:     { type: Number, required: true, min: 1 },
  type:       { type: String, enum: ['deposit', 'withdrawal'], required: true },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  note:       { type: String },
  // Month this payment covers: 'YYYY-MM'  e.g. '2024-03'
  paymentMonth: { type: String, default: null },
  // Target this deposit contributes to (optional)
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'Target', default: null },
  // Admin can upload on behalf of a member
  uploadedByAdmin: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
