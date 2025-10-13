const WEIGHTS = {
  // Recency (thời gian)
  RECENCY_MAX: 100,
  RECENCY_DECAY_RATE: 0.1, // Giảm 10% mỗi giờ

  // Engagement (tương tác)
  REACTION: 1,
  COMMENT: 2,
  SHARE: 3,
  VIEW: 0.01,

  // User interaction (tương tác của chính user)
  USER_REACTED: 30,
  USER_COMMENTED: 40,

  // Friend factor
  FRIEND_POST: 20,

  // Ads targeting
  AD_BASE: 50,
  AD_GENDER_MATCH: 60,
  AD_AGE_MATCH: 100,
  AD_LOCATION_MATCH_GPS: 150, // Location từ GPS
  AD_LOCATION_MATCH_IP: 100, // Location từ IP
  AD_LOCATION_MATCH_PROFILE: 60, // Location từ profile user
  AD_PRIORITY_MULTIPLIER: 1.5, // Nhân với priority của ad
};

/**
 * Tính recency score (decay exponential)
 */
function calculateRecencyScore(createdAt) {
  const ageInHours = (Date.now() - new Date(createdAt)) / 3600000;

  // Exponential decay: score = max * e^(-decay * age)
  const score =
    WEIGHTS.RECENCY_MAX * Math.exp(-WEIGHTS.RECENCY_DECAY_RATE * ageInHours);

  return Math.max(0, score);
}

/**
 * Tính engagement score
 */
function calculateEngagementScore(post) {
  return (
    (post.reactionCount || 0) * WEIGHTS.REACTION +
    (post.commentCount || 0) * WEIGHTS.COMMENT +
    (post.sharesCount || 0) * WEIGHTS.SHARE +
    (post.viewCount || 0) * WEIGHTS.VIEW
  );
}

/**
 * Check location matching với nhiều level
 */
function checkLocationMatch(userLocation, targetLocations) {
  if (!userLocation || !targetLocations?.length) {
    return { matched: false, level: null };
  }

  const searchable = userLocation.searchable || "";

  for (const target of targetLocations) {
    const targetLower = target.toLowerCase().trim();

    // Level 1: Country code exact match (VN, US, etc.)
    if (userLocation.countryCode?.toLowerCase() === targetLower) {
      return { matched: true, level: "country_code" };
    }

    // Level 2: City exact match
    if (userLocation.city?.toLowerCase() === targetLower) {
      return { matched: true, level: "city" };
    }

    // Level 3: Province exact match
    if (userLocation.province?.toLowerCase() === targetLower) {
      return { matched: true, level: "province" };
    }

    // Level 4: Country exact match
    if (userLocation.country?.toLowerCase() === targetLower) {
      return { matched: true, level: "country" };
    }

    // Level 5: Partial match in searchable string
    if (searchable.includes(targetLower)) {
      return { matched: true, level: "partial" };
    }
  }

  return { matched: false, level: null };
}

/**
 * Tính ads targeting score
 */
function calculateAdsScore(ad, user, userLocation) {
  let score = WEIGHTS.AD_BASE;
  const matches = {
    gender: false,
    age: false,
    location: false,
    locationLevel: null,
  };

  // Gender targeting
  if (user.gender && ad.target_gender?.includes(user.gender)) {
    score += WEIGHTS.AD_GENDER_MATCH;
    matches.gender = true;
  }

  // Age targeting
  if (user.age) {
    const minAge = ad.target_age?.min || 0;
    const maxAge = ad.target_age?.max || 150;

    if (user.age >= minAge && user.age <= maxAge) {
      score += WEIGHTS.AD_AGE_MATCH;
      matches.age = true;
    }
  }

  // Location targeting - ưu tiên theo nguồn
  const locationMatch = checkLocationMatch(userLocation, ad.target_location);

  if (locationMatch.matched) {
    matches.location = true;
    matches.locationLevel = locationMatch.level;

    // Score khác nhau theo nguồn location
    if (userLocation.source === "gps") {
      score += WEIGHTS.AD_LOCATION_MATCH_GPS;
    } else if (userLocation.source === "ip") {
      score += WEIGHTS.AD_LOCATION_MATCH_IP;
    } else {
      score += WEIGHTS.AD_LOCATION_MATCH_PROFILE;
    }
  } else if (user.location && ad.target_location?.includes(user.location)) {
    // Fallback: location từ user profile
    score += WEIGHTS.AD_LOCATION_MATCH_PROFILE;
    matches.location = true;
    matches.locationLevel = "profile";
  }

  // Ad priority multiplier
  if (ad.priority) {
    score *= 1 + (ad.priority / 10) * WEIGHTS.AD_PRIORITY_MULTIPLIER;
  }

  return { score, matches };
}

/**
 * Tính tổng score cho 1 post
 */
function calculatePostScore(post, context) {
  const {
    user,
    userLocation,
    reactedPostIds,
    commentedPostIds,
    friendIds,
    postAds,
  } = context;

  let totalScore = 0;
  let breakdown = {};
  let isAd = false;
  let adMatches = null;

  // 1. Recency score
  const recencyScore = calculateRecencyScore(post.createdAt);
  totalScore += recencyScore;
  breakdown.recency = recencyScore;

  // 2. Engagement score
  const engagementScore = calculateEngagementScore(post);
  totalScore += engagementScore;
  breakdown.engagement = engagementScore;

  // 3. User interaction bonus
  const postIdStr = post._id.toString();
  let userInteractionScore = 0;

  if (reactedPostIds.has(postIdStr)) {
    userInteractionScore += WEIGHTS.USER_REACTED;
  }
  if (commentedPostIds.has(postIdStr)) {
    userInteractionScore += WEIGHTS.USER_COMMENTED;
  }

  totalScore += userInteractionScore;
  breakdown.userInteraction = userInteractionScore;

  // 4. Friend factor
  let friendScore = 0;
  if (friendIds.has(post.user_id?.toString())) {
    friendScore = WEIGHTS.FRIEND_POST;
    totalScore += friendScore;
  }
  breakdown.friend = friendScore;

  // 5. Ads targeting
  const ad = postAds.find((a) => a.post_id.toString() === postIdStr);

  if (ad) {
    isAd = true;
    const adsResult = calculateAdsScore(ad, user, userLocation);
    totalScore += adsResult.score;
    adMatches = adsResult.matches;
    breakdown.ads = adsResult.score;
  }

  return {
    score: totalScore,
    breakdown,
    isAd,
    adMatches,
  };
}

module.exports = {
  WEIGHTS,
  calculatePostScore,
  calculateRecencyScore,
  calculateEngagementScore,
  checkLocationMatch,
  calculateAdsScore,
};
