const axios = require("axios");
const NodeCache = require("node-cache");

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY;

// Cache 1 giờ cho location
const locationCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
  maxKeys: 10000,
});

/**
 * Middleware attach location vào request
 * Priority: GPS coordinates > IP geolocation > null
 */
module.exports.attachLocation = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { lat, lng } = req.query;
    const userId = req.user?._id?.toString();

    // Check user cache trước
    if (userId) {
      const cached = locationCache.get(`user:${userId}`);
      if (cached) {
        req.userLocation = cached;
        req.locationCacheHit = true;
        return next();
      }
    }

    let location = null;

    // CASE 1: Có GPS coordinates
    if (lat && lng) {
      location = await getLocationFromGPS(lat, lng);
    }

    // CASE 2: Fallback to IP
    if (!location) {
      const ip = extractClientIP(req);
      if (ip && !isPrivateIP(ip)) {
        location = await getLocationFromIP(ip);
      }
    }

    req.userLocation = location;
    req.locationCacheHit = false;

    // Cache theo user
    if (userId && location) {
      locationCache.set(`user:${userId}`, location, 3600);
    }

    // Logging
    console.log(`[Location] Resolved in ${Date.now() - startTime}ms`, {
      userId,
      source: location?.source || "none",
      cached: false,
    });

    next();
  } catch (err) {
    console.error("[Location] Error:", {
      message: err.message,
      stack: err.stack,
    });

    req.userLocation = null;
    next(); // Không fail request
  }
};

/**
 * Lấy location từ GPS coordinates
 */
async function getLocationFromGPS(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  // Validate
  if (
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid GPS coordinates");
  }

  // Cache key (làm tròn 2 chữ số thập phân = ~1km precision)
  const coordKey = `gps:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = locationCache.get(coordKey);

  if (cached) {
    return { ...cached, cached: true };
  }

  // Reverse geocoding với LocationIQ
  const url = `https://us1.locationiq.com/v1/reverse.php`;
  const params = {
    key: LOCATIONIQ_KEY,
    lat: latitude,
    lon: longitude,
    format: "json",
    "accept-language": "en", // Đảm bảo tên địa danh tiếng Anh
  };

  try {
    const response = await axios.get(url, {
      params,
      timeout: 3000,
    });

    const data = response.data;
    const addr = data.address || {};

    const location = normalizeLocation({
      lat: latitude,
      lng: longitude,
      district: addr.city_district || addr.suburb || addr.neighbourhood,
      city: addr.city || addr.town || addr.village,
      province: addr.state || addr.region || addr.province,
      country: addr.country,
      countryCode: addr.country_code?.toUpperCase(),
      postalCode: addr.postcode,
      source: "gps",
    });

    // Cache 1 giờ
    locationCache.set(coordKey, location, 3600);

    return location;
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn("[LocationIQ] Rate limit exceeded");
    }
    throw err;
  }
}

/**
 * Lấy location từ IP address
 */
async function getLocationFromIP(ip) {
  const ipKey = `ip:${ip}`;
  const cached = locationCache.get(ipKey);

  if (cached) {
    return { ...cached, cached: true };
  }

  // Dùng ip-api.com (free, 45 req/min)
  const url = `http://ip-api.com/json/${ip}`;
  const params = {
    fields:
      "status,country,countryCode,region,regionName,city,lat,lon,timezone",
  };

  try {
    const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
      signal: AbortSignal.timeout(2000),
    });

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error("IP geolocation failed");
    }

    const location = normalizeLocation({
      lat: data.lat,
      lng: data.lon,
      city: data.city,
      province: data.regionName,
      country: data.country,
      countryCode: data.countryCode,
      timezone: data.timezone,
      source: "ip",
    });

    // Cache 2 giờ (IP ít thay đổi hơn GPS)
    locationCache.set(ipKey, location, 7200);

    return location;
  } catch (err) {
    console.warn(`[IP-API] Failed for ${ip}:`, err.message);
    return null;
  }
}

/**
 * Chuẩn hóa location object
 */
function normalizeLocation(data) {
  const parts = [data.district, data.city, data.province, data.country].filter(
    Boolean
  );

  return {
    lat: data.lat || null,
    lng: data.lng || null,
    district: data.district || null,
    city: data.city || null,
    province: data.province || null,
    country: data.country || null,
    countryCode: data.countryCode || null,
    postalCode: data.postalCode || null,
    timezone: data.timezone || null,
    displayName: parts.join(", "),
    searchable: parts.map((p) => p.toLowerCase()).join(" "),
    source: data.source,
    timestamp: Date.now(),
  };
}

/**
 * Extract IP từ request
 */
function extractClientIP(req) {
  // Priority order
  const ip =
    req.headers["x-client-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress;

  if (ip?.startsWith("::ffff:")) {
    return ip.replace("::ffff:", "");
  }

  return ip;
}

/**
 * Check private IP
 */
function isPrivateIP(ip) {
  return (
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  );
}

// Export utilities
module.exports.clearLocationCache = () => {
  locationCache.flushAll();
  console.log("[Cache] Location cache cleared");
};

module.exports.getLocationCacheStats = () => {
  return locationCache.getStats();
};
