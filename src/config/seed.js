require("dotenv").config();
const mongoose = require("mongoose");
const EmailTemplate = require("../models/Admin/emailTemplate.model");
const templates = [
  {
    type: "verify_email",
    name: "Verify Email",
    subject: "Verify your email address",
    html: `
     <h2>Email Verification</h2>
      <p>Click the link below to verify your email:</p>
      <p><strong>Note:</strong> The link will expire in 15 minutes.</p>
      <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px;">
        <a href="{{link}}" style="color: white; text-decoration: none;">Verify Email</a>
      </button>
    `,
    text: "Please verify your email by clicking this link: {{link}} (expires in 15 minutes)",
  },
  {
    type: "reset_password",
    name: "Reset Password",
    subject: "🔒 Reset Your Password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50;">Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to continue:</p>
        <a href="{{link}}" 
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
    text: "You requested to reset your password.\n\nClick the link below (valid for 15 minutes):\n{{link}}",
  },
];

const seedEmailTemplates = async () => {
  try {
    await mongoose.connect(process.env.DB_STRING);
    console.log("Connected to MongoDB");

    for (const template of templates) {
      const existing = await EmailTemplate.findOne({ name: template.name });
      if (existing) {
        await EmailTemplate.updateOne({ name: template.name }, template);
        console.log(`🔄 Updated: ${template.name}`);
      } else {
        await EmailTemplate.create(template);
        console.log(`✅ Inserted: ${template.name}`);
      }
    }

    console.log("✨ Email templates seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
};

seedEmailTemplates();
