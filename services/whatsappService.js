// server/services/whatsappService.js
import twilio from 'twilio';

let client = null;

const getClient = () => {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith('AC') === false) {
    return null;
  }
  client = twilio(sid, token);
  return client;
};

const isConfigured = () => !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_SMS_FROM)
);

// Format BD phone to E.164 (+880...)
const formatBDPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+88${digits}`;
  if (digits.length === 10) return `+880${digits}`;
  return null;
};

// ── Send WhatsApp ─────────────────────────────────────────────────────────────
export const sendWhatsApp = async (phone, message) => {
  if (!isConfigured()) {
    console.warn('⚠️  Twilio not configured — skipping WhatsApp to', phone);
    return false;
  }
  const to = formatBDPhone(phone);
  if (!to) return false;

  try {
    const c = getClient();
    if (!c) return false;
    await c.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body: message,
    });
    return true;
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return false;
  }
};

// ── Send SMS ──────────────────────────────────────────────────────────────────
export const sendSMS = async (phone, message) => {
  if (!isConfigured()) {
    console.warn('⚠️  Twilio not configured — skipping SMS to', phone);
    return false;
  }
  const to = formatBDPhone(phone);
  if (!to) return false;

  try {
    const c = getClient();
    if (!c) return false;
    await c.messages.create({
      from: process.env.TWILIO_SMS_FROM,
      to,
      body: message,
    });
    return true;
  } catch (err) {
    console.error('SMS send error:', err.message);
    return false;
  }
};

// ── Template messages ─────────────────────────────────────────────────────────
export const wpTransactionApproved = (name, amount, balance) =>
  `👑 *খানবাড়ি ভাই ভাই রয়্যাল সমিতি*\n\nপ্রিয় ${name},\n✅ আপনার জমার অনুরোধ অনুমোদিত হয়েছে।\n\n💰 পরিমাণ: ৳${amount.toLocaleString()}\n💳 বর্তমান ব্যালেন্স: ৳${balance.toLocaleString()}\n\nধন্যবাদ 🙏`;

export const wpTransactionRejected = (name, amount) =>
  `👑 *খানবাড়ি ভাই ভাই রয়্যাল সমিতি*\n\nপ্রিয় ${name},\n❌ দুঃখিত, আপনার ৳${amount.toLocaleString()} জমার অনুরোধ বাতিল হয়েছে।\n\nবিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।`;

export const wpGalleryUpload = (uploaderName, caption) =>
  `👑 *খানবাড়ি ভাই ভাই রয়্যাল সমিতি*\n\n📸 ${uploaderName} গ্যালারিতে নতুন ছবি যোগ করেছেন।${caption ? `\n"${caption}"` : ''}\n\nঅ্যাপ খুলে দেখুন 👉`;

export const wpDueReminder = (name, amount) =>
  `👑 *খানবাড়ি ভাই ভাই রয়্যাল সমিতি*\n\nপ্রিয় ${name},\n⚠️ আপনার বকেয়া পেমেন্ট রয়েছে।\n\n💸 বকেয়া: ৳${amount.toLocaleString()}\n\nঅনুগ্রহ করে দ্রুত পরিশোধ করুন।`;

export const wpCustom = (name, title, message) =>
  `👑 *খানবাড়ি ভাই ভাই রয়্যাল সমিতি*\n\nপ্রিয় ${name},\n\n*${title}*\n\n${message}`;
