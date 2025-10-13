const passport = require("passport");
const { Strategy, ExtractJwt } = require("passport-jwt");
const User = require("../models/user.model");
const publicKey = require("fs").readFileSync(
  "./src/config/public_key.pem",
  "utf-8"
);

passport.use(
  new Strategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: publicKey,
      algorithms: ["RS256"],
    },
    async (jwtPayload, done) => {
      const user = await User.findById(jwtPayload.id).select(
        "-hash -salt -is_deleted -twoFASecret"
      );
      return user
        ? done(null, user)
        : done(null, false, { message: "User not found" });
    }
  )
);

module.exports = passport;
