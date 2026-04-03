// server/services/emailService.js
import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
  return transporter;
};

const emailTemplate = (title, body, footer = '') => `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background:#0d0d1a; font-family:'Helvetica Neue',Arial,sans-serif; }
    .wrap { max-width:520px; margin:0 auto; padding:24px 16px; }
    .card { background:linear-gradient(135deg,#1a1a2e,#16213e); border:1px solid rgba(226,185,111,0.25);
            border-radius:16px; padding:32px 28px; }
    .crown { font-size:36px; text-align:center; margin-bottom:8px; }
    .brand { text-align:center; color:#e2b96f; font-size:15px; font-weight:700;
             letter-spacing:1px; margin-bottom:4px; }
    .sub { text-align:center; color:#64748b; font-size:12px; margin-bottom:24px; }
    .divider { height:1px; background:rgba(226,185,111,0.15); margin:20px 0; }
    h2 { color:#f0f0f0; font-size:18px; margin:0 0 12px; }
    p  { color:#94a3b8; font-size:14px; line-height:1.7; margin:0 0 12px; }
    .highlight { background:rgba(226,185,111,0.1); border:1px solid rgba(226,185,111,0.2);
                 border-radius:10px; padding:14px 18px; margin:16px 0; }
    .highlight span { color:#e2b96f; font-weight:700; font-size:16px; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px;
             font-weight:600; }
    .badge-green  { background:rgba(74,222,128,0.15); color:#4ade80; border:1px solid rgba(74,222,128,0.3); }
    .badge-yellow { background:rgba(251,191,36,0.15); color:#fbbf24; border:1px solid rgba(251,191,36,0.3); }
    .badge-red    { background:rgba(248,113,113,0.15); color:#f87171; border:1px solid rgba(248,113,113,0.3); }
    .footer { text-align:center; color:#374151; font-size:11px; margin-top:20px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="crown">👑</div>
      <div class="brand">খানবাড়ি ভাই ভাই রয়্যাল সমিতি</div>
      <div class="sub">KBBRS Official Notification</div>
      <div class="divider"></div>
      <h2>${title}</h2>
      ${body}
      ${footer ? `<div class="divider"></div><p style="font-size:12px;color:#4b5563;">${footer}</p>` : ''}
    </div>
    <div class="footer">
      এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে। উত্তর দেবেন না।<br/>
      © ${new Date().getFullYear()} খানবাড়ি ভাই ভাই রয়্যাল সমিতি
    </div>
  </div>
</body>
</html>`;

// ── Generic send ──────────────────────────────────────────────────────────────
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn('⚠️  Email not configured — skipping send to', to);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to,
      subject,
      html,
      text: text || subject,
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
};

// ── Transaction approved ──────────────────────────────────────────────────────
export const sendTransactionApprovedEmail = async (user, transaction) => {
  const body = `
    <p>প্রিয় <strong style="color:#f0f0f0">${user.name}</strong>,</p>
    <p>আপনার জমার অনুরোধ অনুমোদিত হয়েছে।</p>
    <div class="highlight">
      <div>পরিমাণ: <span>৳${transaction.amount.toLocaleString()}</span></div>
      <div style="margin-top:6px;color:#94a3b8;font-size:13px;">
        সদস্য আইডি: ${user.memberId} &nbsp;|&nbsp;
        তারিখ: ${new Date().toLocaleDateString('bn-BD')}
      </div>
    </div>
    <p>বর্তমান ব্যালেন্স: <span style="color:#4ade80;font-weight:700;">৳${user.balance.toLocaleString()}</span></p>
    <span class="badge badge-green">✓ অনুমোদিত</span>`;

  return sendEmail({
    to: user.email,
    subject: `✅ জমা অনুমোদিত — ৳${transaction.amount.toLocaleString()} | KBBRS`,
    html: emailTemplate('জমার অনুরোধ অনুমোদিত হয়েছে', body),
  });
};

// ── Transaction rejected ──────────────────────────────────────────────────────
export const sendTransactionRejectedEmail = async (user, transaction) => {
  const body = `
    <p>প্রিয় <strong style="color:#f0f0f0">${user.name}</strong>,</p>
    <p>দুঃখিত, আপনার জমার অনুরোধটি বাতিল হয়েছে।</p>
    <div class="highlight">
      <div>পরিমাণ: <span style="color:#f87171">৳${transaction.amount.toLocaleString()}</span></div>
    </div>
    <p>আরও তথ্যের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
    <span class="badge badge-red">✗ বাতিল</span>`;

  return sendEmail({
    to: user.email,
    subject: `❌ জমার অনুরোধ বাতিল | KBBRS`,
    html: emailTemplate('জমার অনুরোধ বাতিল হয়েছে', body),
  });
};

// ── New gallery photo (broadcast) ────────────────────────────────────────────
export const sendGalleryUploadEmail = async (users, uploaderName, caption) => {
  const body = `
    <p><strong style="color:#e2b96f">${uploaderName}</strong> গ্যালারিতে নতুন ছবি যোগ করেছেন।</p>
    ${caption ? `<div class="highlight"><span style="color:#f0f0f0">"${caption}"</span></div>` : ''}
    <p>অ্যাপ খুলে গ্যালারিতে দেখুন।</p>`;

  const emails = users.map(u =>
    sendEmail({
      to: u.email,
      subject: `📸 গ্যালারিতে নতুন ছবি — ${uploaderName} | KBBRS`,
      html: emailTemplate('নতুন গ্যালারি ছবি', body),
    })
  );
  return Promise.allSettled(emails);
};

// ── Due payment reminder ──────────────────────────────────────────────────────
export const sendDueReminderEmail = async (user, dueAmount) => {
  const body = `
    <p>প্রিয় <strong style="color:#f0f0f0">${user.name}</strong>,</p>
    <p>আপনার সমিতির বকেয়া পেমেন্ট রয়েছে।</p>
    <div class="highlight">
      <div>বকেয়া পরিমাণ: <span style="color:#fbbf24">৳${dueAmount.toLocaleString()}</span></div>
    </div>
    <p>অনুগ্রহ করে দ্রুত পরিশোধ করুন।</p>
    <span class="badge badge-yellow">⚠ বকেয়া</span>`;

  return sendEmail({
    to: user.email,
    subject: `⚠️ বকেয়া পেমেন্ট — ৳${dueAmount.toLocaleString()} | KBBRS`,
    html: emailTemplate('বকেয়া পেমেন্ট রিমাইন্ডার', body),
  });
};

// ── Custom admin notification ─────────────────────────────────────────────────
export const sendCustomEmail = async (user, title, message) => {
  const body = `
    <p>প্রিয় <strong style="color:#f0f0f0">${user.name}</strong>,</p>
    <div class="highlight"><span style="color:#f0f0f0;font-size:14px;">${message}</span></div>`;

  return sendEmail({
    to: user.email,
    subject: `${title} | KBBRS`,
    html: emailTemplate(title, body),
  });
};
