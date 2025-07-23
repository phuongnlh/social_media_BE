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
  const verificationLink = `${process.env.BASE_URL}:${process.env.PORT}/api/v1/user/verify-email?token=${token}`;

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
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Cannot send email");
  }
};

const sendResetPasswordEmail = async (to, link) => {
  const mailOptions = {
    from: `"My App" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Reset Your Password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><strong>Note:</strong> This link will expire in 15 minutes.</p>
      <a href="${link}" style="padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none;">Reset Password</a>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
