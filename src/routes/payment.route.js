const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/webhook", express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.post("/create-checkout-session", isLogin, paymentController.createCheckoutSession);
router.get("/verify-success", isLogin, paymentController.verifyPaymentSuccess);
router.get("/history", isLogin, paymentController.getPaymentHistory);

module.exports = router;