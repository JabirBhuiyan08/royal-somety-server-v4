// server/models/Target.js
import mongoose from 'mongoose';

const targetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  goal: { type: Number, required: true },
  collected: { type: Number, default: 0 },
  description: { type: String },
  deadline: { type: Date },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Target = mongoose.model('Target', targetSchema);
export default Target;
