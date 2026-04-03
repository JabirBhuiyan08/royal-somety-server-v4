// server/scripts/seed.js
// Run: node scripts/seed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Target from '../models/Target.js';
import Gallery from '../models/Gallery.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/khanbari-somity';

const SEED_MEMBERS = [
  {
    uid: 'seed-admin-001',
    name: 'মোঃ আব্দুল করিম',
    email: 'admin@khanbari.com',
    phone: '01711111111',
    bloodGroup: 'O+',
    role: 'admin',
    balance: 15000,
  },
  {
    uid: 'seed-member-002',
    name: 'মোঃ রফিকুল ইসলাম',
    email: 'rafiq@khanbari.com',
    phone: '01722222222',
    bloodGroup: 'A+',
    role: 'member',
    balance: 8500,
  },
  {
    uid: 'seed-member-003',
    name: 'মোঃ জাহাঙ্গীর আলম',
    email: 'jahangir@khanbari.com',
    phone: '01733333333',
    bloodGroup: 'B+',
    role: 'member',
    balance: 12000,
  },
  {
    uid: 'seed-member-004',
    name: 'মোঃ সালাহউদ্দিন',
    email: 'salah@khanbari.com',
    phone: '01744444444',
    bloodGroup: 'AB+',
    role: 'member',
    balance: 5000,
  },
  {
    uid: 'seed-member-005',
    name: 'মোঃ কামরুজ্জামান',
    email: 'kamrul@khanbari.com',
    phone: '01755555555',
    bloodGroup: 'O-',
    role: 'member',
    balance: 9000,
  },
  {
    uid: 'seed-member-006',
    name: 'মোঃ হাসানুজ্জামান',
    email: 'hasan@khanbari.com',
    phone: '01766666666',
    bloodGroup: 'B-',
    role: 'member',
    balance: 3500,
  },
];

const SEED_TARGETS = [
  {
    title: '২৪ শতাংশ জমি ক্রয়',
    category: 'জমি কেনা',
    goal: 500000,
    collected: 335000,
    description: 'সমিতির জন্য ২৪ শতাংশ জমি ক্রয়ের লক্ষ্যমাত্রা',
    deadline: new Date('2025-12-31'),
    isActive: true,
  },
  {
    title: 'সমিতি ভবন নির্মাণ',
    category: 'নির্মাণ',
    goal: 800000,
    collected: 120000,
    description: 'সমিতির নিজস্ব ভবন নির্মাণ',
    deadline: new Date('2026-06-30'),
    isActive: true,
  },
  {
    title: 'জরুরি তহবিল গঠন',
    category: 'জরুরি তহবিল',
    goal: 100000,
    collected: 67000,
    description: 'সদস্যদের জরুরি প্রয়োজনে সহায়তার জন্য তহবিল',
    isActive: true,
  },
];

const SEED_GALLERY = [
  {
    url: 'https://images.unsplash.com/photo-1543269664-76bc3997d9ea?w=800',
    caption: 'বার্ষিক সভা ২০২৪',
  },
  {
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800',
    caption: 'সমিতির পিকনিক',
  },
  {
    url: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800',
    caption: 'ঈদ পুনর্মিলনী',
  },
  {
    url: 'https://images.unsplash.com/photo-1519671282429-b8f8dc6c1c3a?w=800',
    caption: 'জমি পরিদর্শন',
  },
  {
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
    caption: 'সদস্য সভা',
  },
  {
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800',
    caption: 'পুরস্কার বিতরণী',
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ ডাটাবেজ সংযুক্ত');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      Target.deleteMany({}),
      Gallery.deleteMany({}),
    ]);
    console.log('🗑️  পুরনো ডেটা মুছে ফেলা হয়েছে');

    // Create users
    const users = await User.insertMany(SEED_MEMBERS);
    console.log(`👥 ${users.length} জন সদস্য তৈরি হয়েছে`);

    const adminUser = users[0];

    // Create targets
    const targets = await Target.insertMany(
      SEED_TARGETS.map(t => ({ ...t, createdBy: adminUser._id }))
    );
    console.log(`🎯 ${targets.length}টি লক্ষ্য তৈরি হয়েছে`);

    // Create gallery
    const photos = await Gallery.insertMany(
      SEED_GALLERY.map(p => ({ ...p, uploadedBy: adminUser._id }))
    );
    console.log(`🖼️  ${photos.length}টি গ্যালারি ছবি তৈরি হয়েছে`);

    // Create sample transactions for each member
    const txData = [];
    for (const user of users) {
      // Approved deposits
      txData.push({
        user: user._id,
        amount: 5000,
        type: 'deposit',
        status: 'approved',
        note: 'মাসিক চাঁদা - জানুয়ারি ২০২৪',
        approvedBy: adminUser._id,
        approvedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-10'),
      });
      txData.push({
        user: user._id,
        amount: 5000,
        type: 'deposit',
        status: 'approved',
        note: 'মাসিক চাঁদা - ফেব্রুয়ারি ২০২৪',
        approvedBy: adminUser._id,
        approvedAt: new Date('2024-02-15'),
        createdAt: new Date('2024-02-10'),
      });
    }

    // Pending deposits (for testing approval workflow)
    txData.push({
      user: users[1]._id,
      amount: 3000,
      type: 'deposit',
      status: 'pending',
      note: 'মাসিক চাঁদা - মার্চ ২০২৪',
    });
    txData.push({
      user: users[2]._id,
      amount: 5000,
      type: 'deposit',
      status: 'pending',
      note: 'বিশেষ চাঁদা',
    });

    const transactions = await Transaction.insertMany(txData);
    console.log(`💸 ${transactions.length}টি লেনদেন তৈরি হয়েছে`);

    console.log('\n✅ সিড সম্পন্ন!');
    console.log('─────────────────────────────────────────');
    console.log('অ্যাডমিন ইমেইল : admin@khanbari.com');
    console.log('সদস্য আইডি    : KBBRS-0001');
    console.log('─────────────────────────────────────────');
    console.log('⚠️  Firebase Authentication-এ ম্যানুয়ালি ইউজার তৈরি করুন।');
    console.log('    UID গুলো seed-admin-001, seed-member-002 ইত্যাদি হিসেবে।');
    console.log('    অথবা অ্যাপ থেকে Signup করুন এবং MongoDB-তে role আপডেট করুন।\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ সিড ব্যর্থ:', err);
    process.exit(1);
  }
}

seed();
