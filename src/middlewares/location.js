const { default: axios } = require("axios");

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY;
module.exports.attachLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.query; // GPS từ FE (nếu có)
    let location = null;

    if (lat && lng) {
      // Có GPS → geocoding
      const url = `https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lng}&format=json`;
      const geoRes = await axios.get(url);
      const data = geoRes.data;

      const addr = data.address || {};
      location = {
        district: addr.city_district,
        province: addr.city,
        country: addr.country,
      };
    } else {
      // Không GPS → fallback IP
      let ip = req.headers["x-client-ip"] || req.socket.remoteAddress;
      if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

      const ipRes = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,regionName`
      );
      const ipData = await ipRes.json();
      if (ipData.status === "success") {
        location = {
          district: null,
          province: ipData.regionName,
          country: ipData.country,
        };
      }
    }

    req.userLocation = location; // gắn location vào request để controller sử dụng
    next();
  } catch (err) {
    console.error("Lỗi attachLocation:", err);
    req.userLocation = null;
    next();
  }
};
