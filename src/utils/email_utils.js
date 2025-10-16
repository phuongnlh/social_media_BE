const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendVerificationEmail = async (to, token) => {
  const template = await EmailTemplate.findOne({ type: "verify_email" });
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const subject = template?.subject || "Verify your email address";
  const html = template
    ? template.html.replaceAll("{{email}}", to).replaceAll("{{link}}", link)
    : `
      <h2>Email Verification</h2>
      <p>Click the link below to verify your email:</p>
      <p><strong>Note:</strong> The link will expire in 15 minutes.</p>
      <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px;">
        <a href="${link}" style="color: white; text-decoration: none;">Verify Email</a>
      </button>
    `;
  const text =
    template?.text ||
    `Please verify your email by clicking the link: ${link}. Note: The link will expire in 15 minutes.`;

  const mailOptions = {
    from: {
      name: "DailyVibe Support",
      address: process.env.SMTP_EMAIL,
    },
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Cannot send email");
  }
};

const sendResetPasswordEmail = async (to, link) => {
  const template = await EmailTemplate.findOne({ type: "reset_password" });

  const subject = template?.subject || "🔒 Reset Your Password";
  const html = template
    ? template.html.replaceAll("{{email}}", to).replaceAll("{{link}}", link)
    : `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50;">Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to continue:</p>
        <a href="${link}" 
           style="display:inline-block; margin: 10px 0; padding: 12px 20px; background: #4CAF50; color: #fff; 
                  text-decoration: none; border-radius: 5px; font-weight: bold;">
          Reset Password
        </a>
        <p><strong>Note:</strong> This link will expire in 15 minutes.</p>
        <hr>
        <p style="font-size: 12px; color: #777;">
          If you did not request this, please ignore this email.
        </p>
      </div>
    `;
  const text =
    template?.text || `You requested to reset your password.\n\nClick the link below (valid for 15 minutes):\n${link}`;
  const mailOptions = {
    from: {
      name: "DailyVibe Support",
      address: process.env.SMTP_EMAIL,
    },
    to,
    subject,
    text,
    html,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
