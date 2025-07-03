const mongoose = require("mongoose");
require("dotenv").config();
const connDB = () => {
  mongoose.connect(process.env.DB_STRING);
};
module.exports = connDB;
