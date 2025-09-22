module.exports.attachLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.query; // GPS từ FE (nếu có)
    let location = null;

    if (lat && lng) {
      // Có GPS → geocoding
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const geoRes = await fetch(url);
      const data = await geoRes.json();

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
