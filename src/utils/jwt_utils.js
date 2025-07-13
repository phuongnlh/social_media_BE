const jwt = require("jsonwebtoken");
const { readFileSync } = require("fs");
const path = require("path");

const privateKey = readFileSync(
  path.join(__dirname, "../config/private_key.pem"),
  "utf-8"
);
const publicKey = readFileSync(
  path.join(__dirname, "../config/public_key.pem"),
  "utf-8"
);

const signToken = (payload, expiresIn = "1d") =>
  jwt.sign({ id: payload.id }, privateKey, {
    algorithm: "RS256",
    expiresIn,
  });

const verifyToken = (token) =>
  jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
  });
module.exports = { signToken, verifyToken };
