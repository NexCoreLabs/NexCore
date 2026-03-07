(function () {
  const CATEGORY_ORDER = [
    "technology",
    "business",
    "education",
    "finance",
    "healthcare",
    "environment",
    "agriculture",
    "food",
    "travel",
    "transportation",
    "real-estate",
    "media-entertainment",
    "art-design",
    "sports-fitness",
    "community",
    "lifestyle"
  ];

  const CATEGORY_LABELS = {
    technology: "Technology",
    business: "Business",
    education: "Education",
    finance: "Finance",
    healthcare: "Healthcare",
    environment: "Environment",
    agriculture: "Agriculture",
    food: "Food",
    travel: "Travel",
    transportation: "Transportation",
    "real-estate": "Real Estate",
    "media-entertainment": "Media & Entertainment",
    "art-design": "Art & Design",
    "sports-fitness": "Sports & Fitness",
    community: "Community",
    lifestyle: "Lifestyle",
    uncategorized: "Uncategorized"
  };

  const CATEGORY_ICONS = {
    technology: "💻",
    business: "💼",
    education: "🎓",
    finance: "💰",
    healthcare: "🏥",
    environment: "🌱",
    agriculture: "🚜",
    food: "🍽",
    travel: "✈️",
    transportation: "🚆",
    "real-estate": "🏠",
    "media-entertainment": "🎬",
    "art-design": "🎨",
    "sports-fitness": "🏃",
    community: "🤝",
    lifestyle: "✨",
    uncategorized: "🏷"
  };

  const LEGACY_CATEGORY_ALIASES = {
    tech: "technology",
    service: "business",
    product: "technology",
    social: "community",
    commerce: "business",
    "real estate": "real-estate",
    "media & entertainment": "media-entertainment",
    "art & design": "art-design",
    "sports & fitness": "sports-fitness"
  };

  function slugifyCategory(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCategory(value) {
    const normalized = slugifyCategory(value);
    const key = LEGACY_CATEGORY_ALIASES[normalized] || normalized;
    return CATEGORY_ORDER.includes(key) ? key : null;
  }

  function displayCategory(value) {
    return normalizeCategory(value) || "uncategorized";
  }

  function getCategoryClass(value) {
    return `cat-${displayCategory(value)}`;
  }

  function buildCategoryBadge(value, options = {}) {
    const includeIcon = options.includeIcon !== false;
    const key = displayCategory(value);
    const label = CATEGORY_LABELS[key] || CATEGORY_LABELS.uncategorized;
    const icon = includeIcon ? `${CATEGORY_ICONS[key] || ""} ` : "";
    return `<span class="project-category ${getCategoryClass(key)}">${icon}${label}</span>`;
  }

  function setCategoryBadge(element, value, options = {}) {
    if (!element) return;
    element.innerHTML = buildCategoryBadge(value, options);
  }

  function getCategoryStats(projects) {
    const counts = { uncategorized: 0 };
    CATEGORY_ORDER.forEach((key) => {
      counts[key] = 0;
    });

    (projects || []).forEach((project) => {
      const key = normalizeCategory(project?.category) || "uncategorized";
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }

  window.ProjectCategories = {
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    normalizeCategory,
    displayCategory,
    getCategoryClass,
    buildCategoryBadge,
    setCategoryBadge,
    getCategoryStats
  };
})();
