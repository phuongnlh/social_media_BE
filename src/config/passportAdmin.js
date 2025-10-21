const passport = require("passport");
const { Strategy, ExtractJwt } = require("passport-jwt");
const Admin = require("../models/Admin/admin.model");
const publicKey = require("fs").readFileSync("./src/config/public_key.pem", "utf-8");

passport.use(
  "jwt-admin",
  new Strategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: publicKey,
      algorithms: ["RS256"],
    },
    async (jwtPayload, done) => {
      const user = await Admin.findById(jwtPayload.id).select("-hash -salt");
      return user ? done(null, user) : done(null, false, { message: "User not found" });
    }
  )
);

module.exports = passport;
