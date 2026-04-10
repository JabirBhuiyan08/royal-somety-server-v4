// server/models/User.js
import mongoose from 'mongoose';

// Counter model for sequential memberId
const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

// Get next sequential memberId
async function getNextMemberId() {
  // Try to initialize counter from existing users if not set
  let counter = await Counter.findOne({ name: 'memberId' });
  
  if (!counter) {
    // Find highest existing memberId number
    const lastUser = await mongoose.model('User').findOne({})
      .sort({ memberId: -1 })
      .select('memberId');
    
    let startSeq = 1;
    if (lastUser?.memberId) {
      const match = lastUser.memberId.match(/KBBRS-(\d+)/);
      if (match) {
        startSeq = parseInt(match[1], 10) + 1;
      }
    }
    
    counter = await Counter.findOneAndUpdate(
      { name: 'memberId' },
      { $setOnInsert: { name: 'memberId', seq: startSeq - 1 } },
      { new: true, upsert: true }
    );
  }
  
  // Increment and return
  const updated = await Counter.findOneAndUpdate(
    { name: 'memberId' },
    { $inc: { seq: 1 } },
    { new: true }
  );
  
  return `KBBRS-${String(updated.seq).padStart(4, '0')}`;
}

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  memberId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // Optional - can be null for phone-only auth
  phone: { type: String },
  bloodGroup: { type: String, default: null }, // Allow null/empty - validated in forms
  avatar: { type: String, default: null },
  coverPhoto: { type: String, default: null },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  balance: { type: Number, default: 0 },
  monthlyDeposit: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate sequential member ID
userSchema.pre('save', async function (next) {
  if (!this.memberId) {
    // Use atomic counter for sequential IDs
    this.memberId = await getNextMemberId();
  }
  next();
});

// Static method to get next memberId (for admin creation)
userSchema.statics.getNextMemberId = getNextMemberId;

const User = mongoose.model('User', userSchema);
export default User;
