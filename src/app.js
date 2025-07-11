require("dotenv").config();
const passport = require("./config/passport");
const connDB = require("./config/database.mongo");
const redisClient = require("./config/database.redis");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const indexRoute = require("./routes/index");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // chỉnh lại nếu cần bảo mật
    methods: ["GET", "POST"],
  },
});

require("./socket")(io);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    name: process.env.SESSION_NAME,
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DB_STRING,
      collectionName: process.env.COLLECTION_SESSION,
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.SECURE_COOKIE === "false",
      httpOnly: true,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/v1", indexRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("INTERNAL SERVER ERROR!");
});

module.exports = app;