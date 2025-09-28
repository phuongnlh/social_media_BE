const login = (req, res) => {
  const { username, password } = req.body;
  // Thực hiện xác thực người dùng (ví dụ: kiểm tra trong cơ sở dữ liệu)
  if (username === "admin" && password === "admin") {
    const adminToken = signToken({ id: user._id }, "1d");
    res.status(200).json({ message: "Admin login successful", adminToken });
  } else {
    res.status(401).json({ message: "Admin login failed" });
  }
};

module.exports = {
  login,
};
