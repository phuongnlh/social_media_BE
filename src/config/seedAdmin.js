require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin/admin.model");
const { genPwd } = require("../utils/pwd_utils");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.DB_STRING);
    console.log("Connected to MongoDB");

    const existing = await Admin.findOne({ email: "admin@dailyvibe.online" });
    if (existing) {
      return console.log("Admin user already exists. Skipping seeding.");
    } else {
      const { hash, salt } = genPwd("adminDailyvibe2025!");
      await Admin.create({
        username: "adminDailyvibe",
        email: "admin@dailyvibe.online",
        fullName: "ADMIN",
        hash,
        salt,
      });
    }

    console.log("✨ Admin user seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
};

seedAdmin();
