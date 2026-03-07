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

  function getCategoryIconMarkup(category) {
    const iconMap = {
      technology: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/></svg>',
      business: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
      education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 9 12 4l10 5-10 5L2 9Z"/><path d="M6 11v4c0 1.8 2.7 3 6 3s6-1.2 6-3v-4"/></svg>',
      finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="14" r="2"/></svg>',
      healthcare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>',
      environment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 14c0-5 4-9 10-9 0 6-4 10-9 10"/><path d="M8 16c1.5 2.5 5 3.5 8 2"/></svg>',
      agriculture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20V9"/><path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5Z"/><path d="M12 15c3 0 5-2 5-5-3 0-5 2-5 5Z"/></svg>',
      food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3v7M5 3v7M9 3v7M7 10v11"/><path d="M16 3c2 0 3 2 3 4s-1 4-3 4v10"/></svg>',
      travel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 14h7l4 5h2l-2-5h7a2 2 0 0 0 0-4h-7l2-5h-2l-4 5H3"/></svg>',
      transportation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="16" height="10" rx="2"/><path d="M7 16v2M17 16v2"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>',
      "real-estate": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
      "media-entertainment": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10 9 5 3-5 3Z"/></svg>',
      "art-design": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h2a5 5 0 0 0 0-10z"/><circle cx="7.5" cy="10" r="1"/><circle cx="9.5" cy="7" r="1"/><circle cx="13" cy="6" r="1"/></svg>',
      "sports-fitness": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10v4M7 8v8M17 8v8M21 10v4"/><path d="M7 12h10"/></svg>',
      community: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M4 18a5 5 0 0 1 10 0"/><path d="M14 18a4 4 0 0 1 7 0"/></svg>',
      lifestyle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 1.6 3.4L17 8l-3.4 1.6L12 13l-1.6-3.4L7 8l3.4-1.6L12 3Z"/><path d="m18 14 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/><path d="m6 14 .8 1.6L8.5 16l-1.7.8L6 18.5l-.8-1.7L3.5 16l1.7-.8L6 14Z"/></svg>',
      uncategorized: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h16v8H4z"/><path d="M10 8V6h4v2"/></svg>'
    };
    return `<span class="pc-icon" aria-hidden="true">${iconMap[category] || iconMap.uncategorized}</span>`;
  }

  const CATEGORY_ICONS = Object.fromEntries(
    [...CATEGORY_ORDER, "uncategorized"].map((category) => [category, getCategoryIconMarkup(category)])
  );

  const LEGACY_CATEGORY_ALIASES = {
    tech: "technology",
    service: "business",
    product: "technology",
    social: "community",
    commerce: "business",
    "real estate": "real-estate",
    "media-and-entertainment": "media-entertainment",
    "art-and-design": "art-design",
    "sports-and-fitness": "sports-fitness"
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
    const icon = includeIcon ? `${CATEGORY_ICONS[key] || ""}` : "";
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
    getCategoryIconMarkup,
    buildCategoryBadge,
    setCategoryBadge,
    getCategoryStats
  };
})();
