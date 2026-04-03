// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  memberId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  avatar: { type: String, default: null },
  coverPhoto: { type: String, default: null },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  balance: { type: Number, default: 0 },
  monthlyDeposit: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate member ID
userSchema.pre('save', async function (next) {
  if (!this.memberId) {
    const count = await mongoose.model('User').countDocuments();
    this.memberId = `KBBRS-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
