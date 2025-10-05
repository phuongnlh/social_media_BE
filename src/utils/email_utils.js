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
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"My App" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Verify your email address",
    html: `
      <h2>Email Verification</h2>
      <p>Click the link below to verify your email:</p>
      <p><strong>Note:</strong> The link will expire in 15 minutes.</p>
      <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px;">
        <a href="${verificationLink}" style="color: white; text-decoration: none;">Verify Email</a>
      </button>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to:", to);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Cannot send email");
  }
};

const sendResetPasswordEmail = async (to, link) => {
  const mailOptions = {
    from: {
      name: "My App",
      address: process.env.SMTP_EMAIL,
    },
    to,
    subject: "🔒 Reset Your Password",
    text: `You requested to reset your password.\n\nClick the link below (valid for 15 minutes):\n${link}`,
    html: `
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
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
