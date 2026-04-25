import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPass = process.env.GMAIL_APP_PASS;

    if (!gmailUser || !gmailAppPass) {
      const err = new Error('Email service is not configured. Missing GMAIL_USER or GMAIL_APP_PASS.');
      err.statusCode = 500;
      throw err;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"Heliotrope" <${gmailUser}>`,
      to,
      subject,
      html,
    });
    return info;
  } catch (err) {
    console.error('sendEmail failed:', err);
    throw err;
  }
};

const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Heliotrope</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9,#a855f7);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">🌸 Heliotrope</h1>
              <p style="margin:6px 0 0;color:#e9d5ff;font-size:13px;">Artisan Marketplace</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} Heliotrope. All rights reserved.<br/>
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const emailTemplates = {
  sellerApproved: (name) => baseLayout(`
  <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Seller Account Approved ✅</h2>
  <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
    Hi <strong>${name}</strong>, your seller account has been approved.
  </p>
  <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px;padding:16px 20px;margin-bottom:18px;">
    <p style="margin:0;color:#166534;font-size:14px;">
      You can now login and start adding products.
    </p>
  </div>
  <div style="text-align:center;">
    <a href="${process.env.CLIENT_URL}/auth" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#a855f7);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
      Login Now →
    </a>
  </div>
`),

  verifyOTP: (name, otp) => baseLayout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Verify Your Email 📧</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi <strong>${name}</strong>, welcome to Heliotrope! Use the OTP below to verify your email address.</p>
    <div style="background:#f5f3ff;border:2px dashed #a855f7;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#7c3aed;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
      <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:14px;color:#4c1d95;font-family:monospace;">${otp}</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">
      ⏱ This code expires in <strong>10 minutes</strong>.<br/>Do not share this code with anyone.
    </p>
  `),

  welcomeVerified: (name) => baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:56px;">🎉</div>
      <h2 style="margin:12px 0 8px;color:#111827;font-size:22px;">You're in, ${name}!</h2>
      <p style="margin:0;color:#6b7280;font-size:15px;">Your email has been verified. Welcome to the Heliotrope artisan community!</p>
    </div>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#166534;font-size:14px;">✅ Your account is now fully active. Start exploring handcrafted products from artisans.</p>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.CLIENT_URL}" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#a855f7);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Explore Heliotrope →
      </a>
    </div>
  `),

  passwordResetOTP: (name, otp) => baseLayout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Reset Your Password 🔒</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi <strong>${name}</strong>, we received a request to reset your Heliotrope password. Use the OTP below.</p>
    <div style="background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#c2410c;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Password Reset Code</p>
      <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:14px;color:#9a3412;font-family:monospace;">${otp}</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">
      ⏱ This code expires in <strong>10 minutes</strong>.<br/>If you didn't request this, please ignore this email — your password won't change.
    </p>
  `),

  passwordResetSuccess: (name) => baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:56px;">🔑</div>
      <h2 style="margin:12px 0 8px;color:#111827;font-size:22px;">Password Updated, ${name}!</h2>
      <p style="margin:0;color:#6b7280;font-size:15px;">Your Heliotrope password has been reset successfully.</p>
    </div>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#991b1b;font-size:14px;">⚠️ If you did not make this change, please contact us immediately or reset your password again.</p>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.CLIENT_URL}/auth" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#a855f7);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Login to Heliotrope →
      </a>
    </div>
  `),

  orderPlacedSeller: ({ sellerName, buyerName, orderId, totalAmount }) =>
    baseLayout(`
      <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">New order received</h2>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
        Hi <strong>${sellerName || 'Seller'}</strong>, you received a new order from <strong>${buyerName || 'a buyer'}</strong>.
      </p>
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#166534;font-size:14px;">
          <strong>Order:</strong> ${orderId}<br/>
          <strong>Total:</strong> ৳${totalAmount}
        </p>
      </div>
      <p style="margin:0;color:#6b7280;font-size:14px;">Please open your dashboard to accept or reject the order.</p>
    `),

  orderAcceptedBuyer: ({ buyerName, sellerName, orderId }) =>
    baseLayout(`
      <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Order accepted</h2>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
        Hi <strong>${buyerName || 'there'}</strong>, your order has been accepted by <strong>${sellerName || 'the seller'}</strong>.
      </p>
      <div style="background:#f5f3ff;border-left:4px solid #a855f7;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#4c1d95;font-size:14px;">
          <strong>Order:</strong> ${orderId}
        </p>
      </div>
      <p style="margin:0;color:#6b7280;font-size:14px;">We will notify you once a delivery person is assigned.</p>
    `),

  deliveryAssigned: ({ name, orderId }) =>
    baseLayout(`
      <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Delivery assigned</h2>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
        Hi <strong>${name || 'there'}</strong>, your order now has a delivery person assigned.
      </p>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#1e3a8a;font-size:14px;">
          <strong>Order:</strong> ${orderId}
        </p>
      </div>
    `),

  orderInTransit: ({ name, orderId }) =>
    baseLayout(`
      <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Order in transit</h2>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
        Hi <strong>${name || 'there'}</strong>, your order is now in transit.
      </p>
      <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#9a3412;font-size:14px;">
          <strong>Order:</strong> ${orderId}
        </p>
      </div>
    `),

  orderDeliveredReview: ({ name, orderId }) =>
    baseLayout(`
      <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Delivered — please rate</h2>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
        Hi <strong>${name || 'there'}</strong>, your order was delivered successfully.
      </p>
      <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#854d0e;font-size:14px;">
          <strong>Order:</strong> ${orderId}
        </p>
      </div>
      <p style="margin:0;color:#6b7280;font-size:14px;">Please leave a review and rating—your feedback helps sellers and other buyers.</p>
    `),

  specialOffer: ({ title, message }) => baseLayout(`
  <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">${title}</h2>
  <p style="margin:0;color:#6b7280;font-size:15px;">${message}</p>
  <div style="text-align:center;margin-top:22px;">
    <a href="${process.env.CLIENT_URL}" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#a855f7);color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:700;">
      Open Heliotrope
    </a>
  </div>
`),

  productRemoved: (name, productName, reason = '') => baseLayout(`
    <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Product Removed ⚠️</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
      Hi <strong>${name}</strong>, your product <strong>${productName}</strong> has been removed by an admin.
    </p>
    ${reason ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;margin-bottom:18px;"><p style="margin:0;color:#991b1b;font-size:14px;">Reason: ${reason}</p></div>` : ''}
    <p style="margin:0;color:#6b7280;font-size:14px;">If you believe this was a mistake, please contact support.</p>
  `),

  reviewRemoved: (name, reason = '') => baseLayout(`
    <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Review Removed ⚠️</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
      Hi <strong>${name}</strong>, one of your reviews has been removed by an admin after review.
    </p>
    ${reason ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;margin-bottom:18px;"><p style="margin:0;color:#991b1b;font-size:14px;">Reason: ${reason}</p></div>` : ''}
  `),

  accountBlocked: (name, reason = '') => baseLayout(`
    <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Account Blocked 🚫</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
      Hi <strong>${name}</strong>, your Heliotrope account has been blocked by an admin.
    </p>
    ${reason ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;margin-bottom:18px;"><p style="margin:0;color:#991b1b;font-size:14px;">Reason: ${reason}</p></div>` : ''}
    <p style="margin:0;color:#6b7280;font-size:14px;">If you believe this was a mistake, please contact support.</p>
  `),

  accountDeleted: (name) => baseLayout(`
    <h2 style="margin:0 0 10px;color:#111827;font-size:22px;">Account Deleted</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:15px;">
      Hi <strong>${name}</strong>, your Heliotrope account has been permanently deleted by an admin.
    </p>
    <p style="margin:0;color:#6b7280;font-size:14px;">If you believe this was a mistake, please contact support immediately.</p>
  `),
};

