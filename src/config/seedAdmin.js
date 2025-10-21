require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin/admin.model");
const { genPwd, validatePwd } = require("../utils/pwd_utils");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.DB_STRING);
    console.log("Connected to MongoDB");

    const existing = await Admin.findOne({ email: "admin@dailyvibe.online" });
    if (existing) {
      return console.log("Admin user already exists. Skipping seeding.");
    } else {
      const { hash, salt } = genPwd("adminDailyvibe2025!");
      const newUser = await new Admin({
        fullName: "ADMIN",
        email: "admin@dailyvibe.online",
        hash,
        salt,
      }).save();
      newUser.username = newUser._id.toString();
      await newUser.save();
      const isValid = validatePwd("adminDailyvibe2025!", newUser.hash, newUser.salt);
    }

    console.log("✨ Admin user seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
};

seedAdmin();
