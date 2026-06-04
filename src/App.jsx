import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "gabbys-money-garden-v1";
const THEME_KEY = "gabbys-money-garden-theme";

const themeOptions = [
  { value: "garden", label: "Money Garden" },
  { value: "money-mountain", label: "Money Mountain" },
  { value: "dark-city", label: "Money Terminal" },
  { value: "plain", label: "Plain" },
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const defaultCategoryDefinitions = [
  { key: "gym", label: "Gym", kind: "Fixed", icon: "🏋️", recurring: true, archived: false },
  { key: "apple", label: "Apple Storage", kind: "Fixed", icon: "☁️", recurring: true, archived: false },
  { key: "food", label: "Food / Groceries", kind: "Flexible", icon: "🛒", recurring: false, archived: false },
  { key: "coffee", label: "Coffee", kind: "Flexible", icon: "☕", recurring: false, archived: false },
  { key: "restaurants", label: "Restaurants / Takeout", kind: "Flexible", icon: "🍽️", recurring: false, archived: false },
  { key: "shopping", label: "Shopping - Non-Clothing", kind: "Flexible", icon: "🛍️", recurring: false, archived: false },
  { key: "clothing", label: "Clothing", kind: "Flexible", icon: "👗", recurring: false, archived: false },
  { key: "activities", label: "Activities / Entertainment", kind: "Flexible", icon: "🎟️", recurring: false, archived: false },
  { key: "gifts", label: "Gifts", kind: "Flexible", icon: "🎁", recurring: false, archived: false },
  { key: "travel", label: "Vacation / Travel", kind: "Flexible", icon: "✈️", recurring: false, archived: false },
  { key: "misc", label: "Miscellaneous", kind: "Flexible", icon: "🧾", recurring: false, archived: false },
];

const defaultCategories = Object.fromEntries(defaultCategoryDefinitions.map((category) => [category.key, 0]));
const defaultCategoryItems = Object.fromEntries(defaultCategoryDefinitions.map((category) => [category.key, []]));

const defaultCategoryTargets = {
  gym: 15,
  apple: 9.99,
  food: 108.33,
  coffee: 60,
  restaurants: 100,
  shopping: 0,
  clothing: 0,
  activities: 0,
  gifts: 0,
  travel: 0,
  misc: 0,
};

const recurringFieldTargets = {
  roth: "rothMonthlyTarget",
  brokerage: "brokerageTarget",
};

function createManualOverrides(categoryDefinitions = defaultCategoryDefinitions) {
  return {
    categories: Object.fromEntries(categoryDefinitions.map((category) => [category.key, false])),
    roth: false,
    brokerage: false,
  };
}

const defaultManualOverrides = createManualOverrides();

function recurringCategoryKeys(categoryDefinitions = defaultCategoryDefinitions) {
  return categoryDefinitions.filter((category) => category.recurring && !category.archived).map((category) => category.key);
}

function directInputCategoryKeys(categoryDefinitions = defaultCategoryDefinitions) {
  return categoryDefinitions
    .filter((category) => (category.recurring || category.kind === "Fixed") && !category.archived)
    .map((category) => category.key);
}

function activeCategories(categoryDefinitions = defaultCategoryDefinitions) {
  return categoryDefinitions.filter((category) => !category.archived);
}

function makeCategoryKey(label, existingKeys) {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "category";
  let key = base;
  let index = 2;
  while (existingKeys.has(key)) {
    key = `${base}_${index}`;
    index += 1;
  }
  return key;
}

function normalizeCategoryDefinitions(rawCategories) {
  const source = Array.isArray(rawCategories) && rawCategories.length ? rawCategories : defaultCategoryDefinitions;
  const seen = new Set();

  return source
    .map((category, index) => {
      const fallback = defaultCategoryDefinitions[index] || {};
      const label = String(category?.label || fallback.label || "New Category").trim() || "New Category";
      const key = String(category?.key || makeCategoryKey(label, seen)).trim();
      const safeKey = key || makeCategoryKey(label, seen);
      if (seen.has(safeKey)) return null;
      seen.add(safeKey);

      return {
        key: safeKey,
        label,
        kind: category?.kind === "Fixed" ? "Fixed" : "Flexible",
        icon: String(category?.icon || fallback.icon || "🧾"),
        recurring: Boolean(category?.recurring),
        archived: Boolean(category?.archived),
      };
    })
    .filter(Boolean);
}

const defaultData = {
  ownerName: "Gabby",
  selectedMonth: "January",
  categories: defaultCategoryDefinitions,
  targets: {
    income: 4042.82,
    currentCash: 22000,
    cashTarget: 15000,
    rothLimit: 7500,
    rothContributedStart: 0,
    rothMonthlyTarget: 625,
    brokerageTarget: 1000,
    coffeeTarget: 60,
    categoryTargets: defaultCategoryTargets,
  },
  actuals: Object.fromEntries(
    months.map((month) => [
      month,
      {
        categories: defaultCategories,
        categoryItems: defaultCategoryItems,
        roth: 0,
        brokerage: 0,
        cashBuffer: 0,
        manualOverrides: defaultManualOverrides,
      },
    ])
  ),
};

const navItems = ["Dashboard", "Targets", "Monthly Inputs", "Investing", "Notes"];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 0 : 2,
  }).format(toNumber(value));
}

function possessiveName(name) {
  const safeName = String(name || "").trim() || defaultData.ownerName;
  return `${safeName}${safeName.toLowerCase().endsWith("s") ? "'" : "'s"}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function categoryIcon(category, isCity) {
  return category.icon;
}

function categoryValueDefaults(categoryDefinitions) {
  return Object.fromEntries(categoryDefinitions.map((category) => [category.key, 0]));
}

function categoryItemDefaults(categoryDefinitions) {
  return Object.fromEntries(categoryDefinitions.map((category) => [category.key, []]));
}

function makeTransactionId() {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategoryItems(rawItems, categoryDefinitions) {
  const source = rawItems && typeof rawItems === "object" ? rawItems : {};

  return Object.fromEntries(
    categoryDefinitions.map((category) => {
      const items = Array.isArray(source[category.key]) ? source[category.key] : [];

      return [
        category.key,
        items
          .map((item) => ({
            id: String(item?.id || makeTransactionId()),
            name: String(item?.name || ""),
            amount: toNumber(item?.amount),
          }))
          .filter((item) => item.id),
      ];
    })
  );
}

function sumCategoryItems(items = []) {
  return items.reduce((sum, item) => sum + toNumber(item.amount), 0);
}

function getEffectiveMonthActuals(monthActuals, targets, categoryDefinitions = defaultCategoryDefinitions) {
  const manualOverrides = monthActuals.manualOverrides || defaultManualOverrides;
  const categoryItems = normalizeCategoryItems(monthActuals.categoryItems, categoryDefinitions);

  return {
    ...monthActuals,
    categories: { ...categoryValueDefaults(categoryDefinitions), ...monthActuals.categories },
    categoryItems,
    roth: toNumber(monthActuals.roth),
    brokerage: toNumber(monthActuals.brokerage),
    cashBuffer: toNumber(monthActuals.cashBuffer),
    manualOverrides,
  };
}

function getEffectiveActualsByMonth(actuals, targets, categoryDefinitions = defaultCategoryDefinitions) {
  return Object.fromEntries(
    months.map((month) => [month, getEffectiveMonthActuals(actuals[month], targets, categoryDefinitions)])
  );
}

function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const incomingTargets = source.targets && typeof source.targets === "object" ? source.targets : {};
  const incomingCategoryTargets =
    incomingTargets.categoryTargets && typeof incomingTargets.categoryTargets === "object"
      ? incomingTargets.categoryTargets
      : {};
  const normalizedCategories = normalizeCategoryDefinitions(source.categories);
  const normalizedCategoryDefaults = categoryValueDefaults(normalizedCategories);

  const normalized = {
    ...defaultData,
    ownerName: String(source.ownerName || defaultData.ownerName).trim() || defaultData.ownerName,
    selectedMonth: months.includes(source.selectedMonth) ? source.selectedMonth : defaultData.selectedMonth,
    categories: normalizedCategories,
    targets: {
      ...defaultData.targets,
      ...incomingTargets,
      categoryTargets: {
        ...defaultCategoryTargets,
        ...Object.fromEntries(normalizedCategories.map((category) => [category.key, 0])),
        ...incomingCategoryTargets,
      },
    },
    actuals: {},
  };

  months.forEach((month) => {
    const incomingMonth = source.actuals?.[month] || {};
    const hasOverrideMetadata =
      incomingMonth.manualOverrides && typeof incomingMonth.manualOverrides === "object";
    const incomingOverrides = hasOverrideMetadata ? incomingMonth.manualOverrides : {};
    const incomingCategoryOverrides =
      incomingOverrides.categories && typeof incomingOverrides.categories === "object"
        ? incomingOverrides.categories
        : {};
    const incomingCategories = {
      ...normalizedCategoryDefaults,
      ...(incomingMonth.categories || {}),
    };
    const incomingCategoryItems = normalizeCategoryItems(incomingMonth.categoryItems, normalizedCategories);

    normalized.actuals[month] = {
      categories: incomingCategories,
      categoryItems: incomingCategoryItems,
      roth: toNumber(incomingMonth.roth),
      brokerage: toNumber(incomingMonth.brokerage),
      cashBuffer: toNumber(incomingMonth.cashBuffer),
      manualOverrides: {
        categories: {
          ...createManualOverrides(normalizedCategories).categories,
          ...incomingCategoryOverrides,
          ...Object.fromEntries(
            recurringCategoryKeys(normalizedCategories).map((key) => [
              key,
              hasOverrideMetadata ? Boolean(incomingCategoryOverrides[key]) : toNumber(incomingCategories[key]) !== 0,
            ])
          ),
        },
        roth: hasOverrideMetadata ? Boolean(incomingOverrides.roth) : toNumber(incomingMonth.roth) !== 0,
        brokerage: hasOverrideMetadata
          ? Boolean(incomingOverrides.brokerage)
          : toNumber(incomingMonth.brokerage) !== 0,
      },
    };
  });

  Object.keys(normalized.targets).forEach((key) => {
    if (key !== "categoryTargets") normalized.targets[key] = toNumber(normalized.targets[key]);
  });
  Object.keys(normalized.targets.categoryTargets).forEach((key) => {
    normalized.targets.categoryTargets[key] = toNumber(normalized.targets.categoryTargets[key]);
  });

  return normalized;
}

function NumericInput({ label, value, onChange, prefix = "$", hint }) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [value, isEditing]);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="inputShell">
        {prefix ? <b>{prefix}</b> : null}
        <input
          type="number"
          step="0.01"
          value={draft}
          onFocus={(event) => {
            setIsEditing(true);
            if (toNumber(value) === 0) event.target.select();
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (next !== "" && next !== "-" && next !== ".") onChange(toNumber(next));
          }}
          onBlur={() => {
            setIsEditing(false);
            if (draft === "" || draft === "-" || draft === ".") {
              onChange(0);
              setDraft("0");
            } else {
              setDraft(String(toNumber(draft)));
            }
          }}
        />
      </div>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function TransactionAmountInput({ value, onChange, label }) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [value, isEditing]);

  return (
    <div className="inputShell transactionAmount">
      <b>$</b>
      <input
        type="number"
        step="0.01"
        value={draft}
        aria-label={label}
        onFocus={(event) => {
          setIsEditing(true);
          if (toNumber(value) === 0) event.target.select();
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next !== "" && next !== "-" && next !== ".") onChange(toNumber(next));
        }}
        onBlur={() => {
          setIsEditing(false);
          if (draft === "" || draft === "-" || draft === ".") {
            onChange(0);
            setDraft("0");
          } else {
            setDraft(String(toNumber(draft)));
          }
        }}
      />
    </div>
  );
}

function StatCard({ icon, label, value, tone = "" }) {
  return (
    <div className={`statCard ${tone}`}>
      <div className="statIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ value, color = "var(--mint-strong)" }) {
  return (
    <div className="progressTrack">
      <div className="progressFill" style={{ width: `${clamp(value, 0, 100)}%`, background: color }} />
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "garden");
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeData(JSON.parse(saved)) : defaultData;
    } catch {
      return defaultData;
    }
  });
  const importRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.body.dataset.theme = theme;
  }, [theme]);

  const selectedMonth = data.selectedMonth;
  const visibleCategories = useMemo(() => activeCategories(data.categories), [data.categories]);
  const effectiveActuals = useMemo(
    () => getEffectiveActualsByMonth(data.actuals, data.targets, data.categories),
    [data.actuals, data.targets, data.categories]
  );
  const selectedActuals = effectiveActuals[selectedMonth];
  const isCity = theme === "dark-city";
  const isPlain = theme === "plain";
  const isMountain = theme === "money-mountain";

  const totals = useMemo(() => {
    const totalSpending = Object.values(selectedActuals.categories).reduce((sum, item) => sum + toNumber(item), 0);
    const totalInvesting = toNumber(selectedActuals.roth) + toNumber(selectedActuals.brokerage);
    const totalAllocated = totalSpending + totalInvesting + toNumber(selectedActuals.cashBuffer);
    const leftover = toNumber(data.targets.income) - totalAllocated;
    const ytdRoth =
      toNumber(data.targets.rothContributedStart) +
      months.reduce((sum, month) => sum + toNumber(effectiveActuals[month].roth), 0);
    const ytdBrokerage = months.reduce((sum, month) => sum + toNumber(effectiveActuals[month].brokerage), 0);
    const ytdInvesting = months.reduce(
      (sum, month) => sum + toNumber(effectiveActuals[month].roth) + toNumber(effectiveActuals[month].brokerage),
      0
    );
    const rothRemaining = Math.max(toNumber(data.targets.rothLimit) - ytdRoth, 0);
    const rothProgress = data.targets.rothLimit > 0 ? (ytdRoth / data.targets.rothLimit) * 100 : 0;
    const cashAboveReserve = Math.max(toNumber(data.targets.currentCash) - toNumber(data.targets.cashTarget), 0);
    const targetSpending = Object.values(data.targets.categoryTargets).reduce((sum, item) => sum + toNumber(item), 0);

    return {
      totalSpending,
      totalInvesting,
      totalAllocated,
      leftover,
      ytdRoth,
      ytdBrokerage,
      ytdInvesting,
      rothRemaining,
      rothProgress,
      cashAboveReserve,
      targetSpending,
    };
  }, [data, selectedActuals, effectiveActuals]);

  function updateMonth(month) {
    setData((current) => ({ ...current, selectedMonth: month }));
  }

  function updateOwnerName(value) {
    setData((current) => ({ ...current, ownerName: value }));
  }

  function updateTarget(key, value) {
    setData((current) => ({
      ...current,
      targets: {
        ...current.targets,
        [key]: value,
      },
    }));
  }

  function updateCategoryTarget(key, value) {
    setData((current) => ({
      ...current,
      targets: {
        ...current.targets,
        coffeeTarget: key === "coffee" ? value : current.targets.coffeeTarget,
        categoryTargets: {
          ...current.targets.categoryTargets,
          [key]: value,
        },
      },
    }));
  }

  function updateCategoryDefinition(key, updates) {
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.key === key
          ? {
              ...category,
              ...updates,
              label: updates.label !== undefined ? updates.label || "Untitled Category" : category.label,
              kind: updates.kind === "Fixed" ? "Fixed" : updates.kind === "Flexible" ? "Flexible" : category.kind,
            }
          : category
      ),
    }));
  }

  function addCategory() {
    setData((current) => {
      const existingKeys = new Set(current.categories.map((category) => category.key));
      const key = makeCategoryKey("New Category", existingKeys);
      return {
        ...current,
        categories: [
          ...current.categories,
          { key, label: "New Category", kind: "Flexible", icon: "🧾", recurring: false, archived: false },
        ],
        targets: {
          ...current.targets,
          categoryTargets: {
            ...current.targets.categoryTargets,
            [key]: 0,
          },
        },
        actuals: Object.fromEntries(
          months.map((month) => [
            month,
            {
              ...current.actuals[month],
              categories: {
                ...current.actuals[month].categories,
                [key]: 0,
              },
              categoryItems: {
                ...(current.actuals[month].categoryItems || categoryItemDefaults(current.categories)),
                [key]: [],
              },
              manualOverrides: {
                ...(current.actuals[month].manualOverrides || defaultManualOverrides),
                categories: {
                  ...(current.actuals[month].manualOverrides?.categories || {}),
                  [key]: false,
                },
              },
            },
          ])
        ),
      };
    });
  }

  function archiveCategory(key) {
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.key === key ? { ...category, archived: true } : category
      ),
    }));
  }

  function updateActualCategory(key, value) {
    setData((current) => {
      if (!directInputCategoryKeys(current.categories).includes(key)) return current;

      return {
        ...current,
        actuals: {
          ...current.actuals,
          [current.selectedMonth]: {
            ...current.actuals[current.selectedMonth],
            categories: {
              ...current.actuals[current.selectedMonth].categories,
              [key]: value,
            },
            categoryItems: {
              ...categoryItemDefaults(current.categories),
              ...(current.actuals[current.selectedMonth].categoryItems || {}),
              [key]: [],
            },
            manualOverrides: {
              ...(current.actuals[current.selectedMonth].manualOverrides || defaultManualOverrides),
              categories: {
                ...createManualOverrides(current.categories).categories,
                ...(current.actuals[current.selectedMonth].manualOverrides?.categories || {}),
                [key]: recurringCategoryKeys(current.categories).includes(key)
                  ? true
                  : current.actuals[current.selectedMonth].manualOverrides?.categories?.[key] || false,
              },
            },
          },
        },
      };
    });
  }

  function setActualCategoryItems(current, key, items) {
    const currentMonth = current.actuals[current.selectedMonth];
    const categoryItems = {
      ...categoryItemDefaults(current.categories),
      ...(currentMonth.categoryItems || {}),
      [key]: items,
    };

    return {
      ...current,
      actuals: {
        ...current.actuals,
        [current.selectedMonth]: {
          ...currentMonth,
          categories: {
            ...currentMonth.categories,
            [key]: sumCategoryItems(items),
          },
          categoryItems,
          manualOverrides: {
            ...(currentMonth.manualOverrides || defaultManualOverrides),
            categories: {
              ...createManualOverrides(current.categories).categories,
              ...(currentMonth.manualOverrides?.categories || {}),
              [key]: recurringCategoryKeys(current.categories).includes(key)
                ? true
                : currentMonth.manualOverrides?.categories?.[key] || false,
            },
          },
        },
      },
    };
  }

  function addCategoryItem(key) {
    setData((current) => {
      const currentItems = current.actuals[current.selectedMonth].categoryItems?.[key] || [];
      const nextItems = [...currentItems, { id: makeTransactionId(), name: "", amount: 0 }];
      return setActualCategoryItems(current, key, nextItems);
    });
  }

  function updateCategoryItem(key, itemId, updates) {
    setData((current) => {
      const currentItems = current.actuals[current.selectedMonth].categoryItems?.[key] || [];
      const nextItems = currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              name: updates.name !== undefined ? updates.name : item.name,
              amount: updates.amount !== undefined ? toNumber(updates.amount) : item.amount,
            }
          : item
      );
      return setActualCategoryItems(current, key, nextItems);
    });
  }

  function removeCategoryItem(key, itemId) {
    setData((current) => {
      const currentItems = current.actuals[current.selectedMonth].categoryItems?.[key] || [];
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      return setActualCategoryItems(current, key, nextItems);
    });
  }

  function updateActualField(key, value) {
    setData((current) => ({
      ...current,
      actuals: {
        ...current.actuals,
        [current.selectedMonth]: {
          ...current.actuals[current.selectedMonth],
          [key]: value,
          manualOverrides: {
            ...(current.actuals[current.selectedMonth].manualOverrides || defaultManualOverrides),
            categories: {
              ...defaultManualOverrides.categories,
              ...(current.actuals[current.selectedMonth].manualOverrides?.categories || {}),
            },
            [key]: Object.keys(recurringFieldTargets).includes(key)
              ? true
              : current.actuals[current.selectedMonth].manualOverrides?.[key] || false,
          },
        },
      },
    }));
  }

  function useTargetsAsPlaceholders() {
    setData((current) => {
      const currentMonth = current.actuals[current.selectedMonth];
      const directKeys = directInputCategoryKeys(current.categories);

      return {
        ...current,
        actuals: {
          ...current.actuals,
          [current.selectedMonth]: {
            ...currentMonth,
            categories: {
              ...currentMonth.categories,
              ...Object.fromEntries(directKeys.map((key) => [key, current.targets.categoryTargets[key]])),
            },
            roth: current.targets.rothMonthlyTarget,
            brokerage: current.targets.brokerageTarget,
            cashBuffer: currentMonth.cashBuffer,
            manualOverrides: {
              categories: {
                ...createManualOverrides(current.categories).categories,
                ...(currentMonth.manualOverrides?.categories || {}),
                ...Object.fromEntries(recurringCategoryKeys(current.categories).map((key) => [key, true])),
              },
              roth: true,
              brokerage: true,
            },
          },
        },
      };
    });
  }

  function fillRepeatingTargets() {
    setData((current) => {
      const currentMonth = current.actuals[current.selectedMonth];
      return {
        ...current,
        actuals: {
          ...current.actuals,
          [current.selectedMonth]: {
            ...currentMonth,
            categories: {
              ...currentMonth.categories,
              ...Object.fromEntries(
                recurringCategoryKeys(current.categories).map((key) => [key, current.targets.categoryTargets[key]])
              ),
            },
            roth: current.targets.rothMonthlyTarget,
            brokerage: current.targets.brokerageTarget,
            manualOverrides: {
              ...(currentMonth.manualOverrides || defaultManualOverrides),
              categories: {
                ...defaultManualOverrides.categories,
                ...(currentMonth.manualOverrides?.categories || {}),
                ...Object.fromEntries(recurringCategoryKeys(current.categories).map((key) => [key, true])),
              },
              roth: true,
              brokerage: true,
            },
          },
        },
      };
    });
  }

  function resetData() {
    if (window.confirm(`Reset ${possessiveName(data.ownerName)} ${isMountain ? "Money Mountain" : isCity ? "Money Terminal" : "Money Garden"} and clear saved browser data?`)) {
      localStorage.removeItem(STORAGE_KEY);
      setData(normalizeData(defaultData));
      setActivePage("Dashboard");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(normalizeData(data), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gabbys-money-garden-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeData(JSON.parse(reader.result));
        setData(imported);
        setActivePage("Dashboard");
      } catch {
        alert("That backup file could not be imported. Please choose a valid JSON export.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <style>{styles}</style>
      <div className={`app ${theme === "dark-city" ? "darkCity" : ""} ${isPlain ? "plainTheme" : ""} ${isMountain ? "moneyMountain" : ""}`}>
        <div className="gardenBg" aria-hidden="true">
          <span className="sun">{isMountain ? "❄️" : isCity ? "🌙" : "☀️"}</span>
          <span className="cloud cloudA">{isMountain ? "🏔️" : isCity ? "</>" : "☁️"}</span>
          <span className="cloud cloudB">{isMountain ? "🌲" : isCity ? "{}" : "☁️"}</span>
          <span className="sparkle sparkleA">{isMountain ? "🏂" : isCity ? "01" : "✨"}</span>
          <span className="sparkle sparkleB">{isMountain ? "❄️" : isCity ? "$_" : "🌸"}</span>
        </div>

        <header className="hero">
          {isMountain ? (
            <div className="mountainSnow" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, index) => (
                <span
                  key={`snow-${index}`}
                  style={{
                    "--snow-x": `${(index * 37) % 100}%`,
                    "--snow-delay": `${(index % 6) * -0.7}s`,
                    "--snow-duration": `${5 + (index % 5) * 0.8}s`,
                    "--snow-size": `${5 + (index % 4) * 2}px`,
                    "--snow-drift": `${index % 2 === 0 ? 18 : -18}px`,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="heroTopline">
            <div className="kicker">{possessiveName(data.ownerName)}</div>
            <div className="themeButtons">
              <label className="themeSelectField">
                <span>Theme</span>
                <select className="themeSelect" value={theme} onChange={(event) => setTheme(event.target.value)}>
                  {themeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="heroCopy">
            <h1>{isMountain ? "Money Mountain" : isCity ? "Money Terminal" : "Money Garden"}</h1>
            <p className="tagline">
              {isMountain
                ? "Ride the budget down the mountain one clean line at a time."
                : isCity
                  ? "Debug the budget one month at a time."
                  : "Grow the money garden one month at a time."}
            </p>
            <p>
              {isMountain
                ? "Track spending, savings, Roth IRA progress, brokerage contributions, and future move-out money in a crisp winter lodge view."
                : isCity
                ? "Track spending, savings, Roth IRA progress, brokerage contributions, and future move-out money in a quiet command-center view."
                : "Track spending, savings, Roth IRA progress, brokerage contributions, and future move-out money without turning personal finance into a scary spreadsheet jungle."}
            </p>
            <div className="badges" aria-label="App features">
              <span>{isPlain ? "Auto-saves" : isMountain ? "❄️ Auto-saves" : isCity ? "💾 Auto-saves" : "🌱 Auto-saves"}</span>
              <span>{isPlain ? "Editable fields" : isMountain ? "🏂 Editable fields" : isCity ? "⌨️ Editable fields" : "🌼 Editable fields"}</span>
              <span>{isPlain ? "No uploads needed" : isMountain ? "🌲 Local only" : isCity ? "🔒 Local only" : "🪴 No uploads needed"}</span>
            </div>
          </div>

          <div className="gameCard">
            <div className="gameTop">
              <span>{isPlain ? "Saved month" : isMountain ? "🏔️ Lodge Save" : isCity ? "$_ Console Save" : "🪴 Garden Save"}</span>
              <select value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>
                {months.map((month) => (
                  <option key={month}>{month}</option>
                ))}
              </select>
            </div>
            <div className="pixelGarden" aria-hidden="true">
              {(isMountain ? ["🏔️", "🌲", "🏂", "❄️", "🪵"] : isCity ? ["$_", "{}", "01", "<>", "//"] : ["🌷", "🌱", "🌼", "🍄", "🌿"]).map((icon) => (
                <span key={icon}>{icon}</span>
              ))}
            </div>
            <div className="miniStats">
              <div>
                <small>Leftover</small>
                <strong>{money(totals.leftover)}</strong>
              </div>
              <div>
                <small>Roth YTD</small>
                <strong>{money(totals.ytdRoth)}</strong>
              </div>
              <div>
                <small>Cash above reserve</small>
                <strong>{money(totals.cashAboveReserve)}</strong>
              </div>
            </div>
          </div>
        </header>

        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item} className={activePage === item ? "active" : ""} onClick={() => setActivePage(item)}>
              {item}
            </button>
          ))}
          <label className="navMonth">
            <span>Editing</span>
            <select value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>
              {months.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>
        </nav>

        <main>
          {activePage === "Dashboard" && (
            <Dashboard
              data={data}
              categories={visibleCategories}
              totals={totals}
              selectedActuals={selectedActuals}
              selectedMonth={selectedMonth}
              updateMonth={updateMonth}
              isCity={isCity}
              isMountain={isMountain}
            />
          )}
          {activePage === "Targets" && (
            <Targets
              data={data}
              categories={visibleCategories}
              updateTarget={updateTarget}
              updateCategoryTarget={updateCategoryTarget}
              updateCategoryDefinition={updateCategoryDefinition}
              addCategory={addCategory}
              archiveCategory={archiveCategory}
              isCity={isCity}
            />
          )}
          {activePage === "Monthly Inputs" && (
            <MonthlyInputs
              data={data}
              categories={visibleCategories}
              totals={totals}
              selectedActuals={selectedActuals}
              selectedMonth={selectedMonth}
              updateMonth={updateMonth}
              updateActualCategory={updateActualCategory}
              addCategoryItem={addCategoryItem}
              updateCategoryItem={updateCategoryItem}
              removeCategoryItem={removeCategoryItem}
              updateActualField={updateActualField}
              useTargetsAsPlaceholders={useTargetsAsPlaceholders}
              fillRepeatingTargets={fillRepeatingTargets}
              isCity={isCity}
            />
          )}
          {activePage === "Investing" && (
            <Investing data={data} effectiveActuals={effectiveActuals} totals={totals} isCity={isCity} />
          )}
          {activePage === "Notes" && (
            <Notes
              data={data}
              updateOwnerName={updateOwnerName}
              resetData={resetData}
              exportJson={exportJson}
              importRef={importRef}
              importJson={importJson}
              isCity={isCity}
              isMountain={isMountain}
            />
          )}
        </main>
      </div>
    </>
  );
}

function Dashboard({ data, categories, totals, selectedActuals, selectedMonth, updateMonth, isCity, isMountain }) {
  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h2>{selectedMonth}'s {isMountain ? "mountain snapshot" : isCity ? "terminal snapshot" : "garden snapshot"}</h2>
        </div>
        <select className="monthSelect" value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>
          {months.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </select>
      </div>

      <div className="statGrid">
        <StatCard icon={isMountain ? "🏔️" : isCity ? ">" : "🌼"} label="Monthly income" value={money(data.targets.income)} />
        <StatCard icon={isMountain ? "🪵" : isCity ? "🧾" : "🌿"} label="Total spending" value={money(totals.totalSpending)} />
        <StatCard icon={isMountain ? "🌲" : "✨"} label="Total investing" value={money(totals.totalInvesting)} />
        <StatCard icon={isMountain ? "🏂" : isCity ? "$_" : "🏡"} label="Leftover / unallocated" value={money(totals.leftover)} tone={totals.leftover < 0 ? "warning" : "good"} />
      </div>

      <div className="grid two">
        <Card title="Spending by Category" icon={isCity ? "{}" : "🌷"}>
          <SpendingChart categories={categories} actuals={selectedActuals.categories} isCity={isCity} />
        </Card>
        <Card title="Actual vs Target" icon={isCity ? "==" : "🪴"}>
          <TargetProgress categories={categories} data={data} actuals={selectedActuals.categories} isCity={isCity} />
        </Card>
      </div>

      <div className="grid two">
        <Card title="Roth IRA Progress" icon={isCity ? "01" : "🌱"}>
          <div className="progressSummary">
            <strong>{money(totals.ytdRoth)} of {money(data.targets.rothLimit)}</strong>
            <span>{money(totals.rothRemaining)} remaining</span>
          </div>
          <ProgressBar
            value={totals.rothProgress}
            color={isCity ? "linear-gradient(90deg, #7cffb2, #f5f5f5, #8c8c8c)" : "linear-gradient(90deg, #8bd5a4, #a799e8)"}
          />
        </Card>
        <Card title="Cash Reserve" icon={isCity ? "[]" : "🏡"}>
          <div className="cashGrid">
            <div><span>Current cash</span><strong>{money(data.targets.currentCash)}</strong></div>
            <div><span>Reserve target</span><strong>{money(data.targets.cashTarget)}</strong></div>
            <div><span>Above target</span><strong>{money(totals.cashAboveReserve)}</strong></div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Targets({
  data,
  categories,
  updateTarget,
  updateCategoryTarget,
  updateCategoryDefinition,
  addCategory,
  archiveCategory,
  isCity,
}) {
  const targetFields = [
    ["income", "Monthly take-home income"],
    ["currentCash", "Current cash savings"],
    ["cashTarget", "Cash reserve target"],
    ["rothLimit", "2026 Roth IRA limit"],
    ["rothContributedStart", "2026 Roth contributed so far"],
    ["rothMonthlyTarget", "Monthly Roth target"],
    ["brokerageTarget", "Monthly brokerage target"],
    ["coffeeTarget", "Coffee target"],
  ];

  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Targets</span>
          <h2>{isCity ? "Set the monthly config file" : "Set the garden's monthly watering plan"}</h2>
        </div>
      </div>
      <Card title="Core Money Targets" icon={isCity ? ">" : "🌼"}>
        <div className="formGrid">
          {targetFields.map(([key, label]) => (
            <NumericInput
              key={key}
              label={label}
              value={data.targets[key]}
              onChange={(value) => updateTarget(key, value)}
                hint={
                  key === "rothMonthlyTarget" || key === "brokerageTarget"
                  ? "Use Fill repeating targets to apply this to a selected month."
                  : undefined
              }
            />
          ))}
        </div>
      </Card>
      <Card title="Monthly Category Targets" icon={isCity ? "{}" : "🌿"}>
        <div className="categoryTargetGrid">
          {categories.map((category) => {
            const value = data.targets.categoryTargets[category.key];
            return (
              <NumericInput
                key={category.key}
                label={`${categoryIcon(category, isCity)} ${category.label}`}
                value={value}
                onChange={(next) => updateCategoryTarget(category.key, next)}
                hint={
                  category.recurring
                    ? "Use Fill repeating targets to apply this to a selected month."
                    : value === 0
                      ? "Track first, set target later."
                      : category.kind
                }
              />
            );
          })}
        </div>
      </Card>
      <Card title="Edit Categories" icon={isCity ? "🛠️" : "🪴"}>
        <div className="categoryEditorList">
          {categories.map((category) => (
            <div className="categoryEditorRow" key={category.key}>
              <input
                className="textInput emojiInput"
                value={category.icon}
                aria-label={`${category.label} icon`}
                onChange={(event) => updateCategoryDefinition(category.key, { icon: event.target.value })}
              />
              <input
                className="textInput"
                value={category.label}
                aria-label={`${category.label} name`}
                onChange={(event) => updateCategoryDefinition(category.key, { label: event.target.value })}
              />
              <select
                className="selectInput"
                value={category.kind}
                onChange={(event) => updateCategoryDefinition(category.key, { kind: event.target.value })}
              >
                <option>Flexible</option>
                <option>Fixed</option>
              </select>
              <label className="checkField">
                <input
                  type="checkbox"
                  checked={category.recurring}
                  onChange={(event) => updateCategoryDefinition(category.key, { recurring: event.target.checked })}
                />
                <span>Repeating</span>
              </label>
              <button className="dangerButton compactButton" onClick={() => archiveCategory(category.key)}>
                Archive
              </button>
            </div>
          ))}
        </div>
        <button className="softButton addCategoryButton" onClick={addCategory}>Add category</button>
      </Card>
    </section>
  );
}

function MonthlyInputs({
  data,
  categories,
  totals,
  selectedActuals,
  selectedMonth,
  updateMonth,
  updateActualCategory,
  addCategoryItem,
  updateCategoryItem,
  removeCategoryItem,
  updateActualField,
  useTargetsAsPlaceholders,
  fillRepeatingTargets,
  isCity,
}) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [pendingRemovalItems, setPendingRemovalItems] = useState({});
  const [isNarrowMonthlyLayout, setIsNarrowMonthlyLayout] = useState(() => window.innerWidth <= 900);

  useEffect(() => {
    const updateLayout = () => setIsNarrowMonthlyLayout(window.innerWidth <= 900);
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  const monthlyCategoryColumns = useMemo(
    () => {
      if (isNarrowMonthlyLayout) return [categories];

      return categories.reduce(
        (columns, category, index) => {
          columns[index % 2].push(category);
          return columns;
        },
        [[], []]
      );
    },
    [categories, isNarrowMonthlyLayout]
  );

  function toggleCategoryItems(key) {
    setExpandedCategories((current) => ({ ...current, [key]: !current[key] }));
  }

  function openCategoryItems(key) {
    setExpandedCategories((current) => ({ ...current, [key]: true }));
  }

  function pendingRemovalKey(categoryKey, itemId) {
    return `${categoryKey}:${itemId}`;
  }

  function requestItemRemoval(categoryKey, itemId) {
    setPendingRemovalItems((current) => ({ ...current, [pendingRemovalKey(categoryKey, itemId)]: true }));
  }

  function cancelItemRemoval(categoryKey, itemId) {
    setPendingRemovalItems((current) => {
      const next = { ...current };
      delete next[pendingRemovalKey(categoryKey, itemId)];
      return next;
    });
  }

  function confirmItemRemoval(categoryKey, itemId) {
    cancelItemRemoval(categoryKey, itemId);
    removeCategoryItem(categoryKey, itemId);
  }

  function renderMonthlyCategory(category) {
    const items = selectedActuals.categoryItems?.[category.key] || [];
    const isExpanded = Boolean(expandedCategories[category.key]);
    const usesDirectTotal = category.recurring || category.kind === "Fixed";

    return (
      <div className="monthlyCategoryCard" key={category.key}>
        {usesDirectTotal ? (
          <NumericInput
            label={`${categoryIcon(category, isCity)} ${category.label}`}
            value={selectedActuals.categories[category.key]}
            onChange={(value) => updateActualCategory(category.key, value)}
            hint="Fixed or repeating category. Enter the monthly total directly."
          />
        ) : (
          <>
            <div className="readonlyCategoryTotal">
              <span>{categoryIcon(category, isCity)} {category.label}</span>
              <strong>{money(selectedActuals.categories[category.key])}</strong>
              <small>{items.length ? `${items.length} item${items.length === 1 ? "" : "s"} entered.` : "Add items to update this total."}</small>
            </div>
            <div className="itemToolbar">
              <button
                className={`softButton compactButton itemToggleButton ${isExpanded ? "expanded" : ""}`}
                onClick={() => toggleCategoryItems(category.key)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Hide" : "Show"} ${category.label} items`}
              >
                <span className="itemToggleIcon" aria-hidden="true">&gt;</span>
                <span>Items ({items.length})</span>
              </button>
              <button
                className="softButton compactButton addItemButton"
                onClick={() => {
                  openCategoryItems(category.key);
                  addCategoryItem(category.key);
                }}
              >
                Add item
              </button>
            </div>
            <div className={`transactionListWrap ${isExpanded ? "expanded" : ""}`}>
              <div className="transactionList">
                {items.length ? (
                  items.map((item) => {
                    const isPendingRemoval = Boolean(pendingRemovalItems[pendingRemovalKey(category.key, item.id)]);

                    return (
                      <div className="transactionRow" key={item.id}>
                        <input
                          className="textInput transactionName"
                          value={item.name}
                          placeholder="Item"
                          aria-label={`${category.label} item name`}
                          onChange={(event) => updateCategoryItem(category.key, item.id, { name: event.target.value })}
                        />
                        <TransactionAmountInput
                          value={item.amount}
                          label={`${category.label} item amount`}
                          onChange={(amount) => updateCategoryItem(category.key, item.id, { amount })}
                        />
                        {isPendingRemoval ? (
                          <div className="removeConfirmGroup" aria-label={`Confirm removing ${category.label} item`}>
                            <button
                              className="dangerButton compactButton confirmRemoveButton"
                              onClick={() => confirmItemRemoval(category.key, item.id)}
                              aria-label={`Confirm remove ${category.label} item`}
                            >
                              ✓
                            </button>
                            <button
                              className="softButton compactButton cancelRemoveButton"
                              onClick={() => cancelItemRemoval(category.key, item.id)}
                              aria-label={`Cancel remove ${category.label} item`}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            className="dangerButton compactButton removeItemButton"
                            onClick={() => requestItemRemoval(category.key, item.id)}
                            aria-label={`Remove ${category.label} item`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <small>No itemized transactions yet.</small>
                )}
              </div>
            </div>
          </>
        )}
          </div>
    );
  }

  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Monthly Inputs</span>
          <h2>Type in {selectedMonth}'s totals</h2>
        </div>
        <div className="actions">
          <select className="monthSelect" value={selectedMonth} onChange={(event) => updateMonth(event.target.value)}>
            {months.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </select>
          <button className="softButton" onClick={fillRepeatingTargets}>Fill repeating targets</button>
          <button className="softButton" onClick={useTargetsAsPlaceholders}>Use targets as placeholders</button>
        </div>
      </div>

      <Card title="Spending Totals" icon={isCity ? "{}" : "🌷"}>
        <div className="monthlyCategoryGrid">
          {monthlyCategoryColumns.map((column, index) => (
            <div className="monthlyCategoryColumn" key={`monthly-category-column-${index}`}>
              {column.map((category) => renderMonthlyCategory(category))}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid two">
        <Card title="Saving and Investing" icon="✨">
          <div className="formGrid">
            <NumericInput
              label="Roth IRA Contribution"
              value={selectedActuals.roth}
              onChange={(value) => updateActualField("roth", value)}
              hint="Only counts after you enter it or use Fill repeating targets."
            />
            <NumericInput
              label="Brokerage Contribution"
              value={selectedActuals.brokerage}
              onChange={(value) => updateActualField("brokerage", value)}
              hint="Only counts after you enter it or use Fill repeating targets."
            />
            <NumericInput label="Cash Buffer / Move-Out Fund" value={selectedActuals.cashBuffer} onChange={(value) => updateActualField("cashBuffer", value)} />
          </div>
        </Card>
        <Card title={`${selectedMonth} Summary`} icon={isCity ? "==" : "🪴"}>
          <div className="summaryList">
            <Row label="Total spending" value={money(totals.totalSpending)} />
            <Row label="Roth contribution" value={money(selectedActuals.roth)} />
            <Row label="Brokerage contribution" value={money(selectedActuals.brokerage)} />
            <Row label="Cash buffer" value={money(selectedActuals.cashBuffer)} />
            <Row label="Leftover / disposable income" value={money(totals.leftover)} strong />
          </div>
        </Card>
      </div>
    </section>
  );
}

function Investing({ data, effectiveActuals, totals, isCity }) {
  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Investing</span>
          <h2>Steady, comfort-first growth plan</h2>
        </div>
      </div>

      <div className="grid two">
        <Card title="Cozy Strategy" icon={isCity ? "$_" : "🌱"}>
          <ul className="noteList">
            <li>{money(data.targets.rothMonthlyTarget)}/month Roth default, with an optional later top-up.</li>
            <li>{money(data.targets.brokerageTarget)}/month brokerage target when the month feels comfortable.</li>
            <li>Keep about {money(data.targets.cashTarget)} as a cash reserve before getting too ambitious.</li>
            <li>Review after 2-3 months and adjust based on real spending, not pressure.</li>
          </ul>
        </Card>
        <Card title="Roth IRA Yearly Progress" icon={isCity ? ">" : "🌼"}>
          <div className="progressSummary">
            <strong>{money(totals.ytdRoth)} saved</strong>
            <span>{money(totals.rothRemaining)} left toward {money(data.targets.rothLimit)}</span>
          </div>
          <ProgressBar
            value={totals.rothProgress}
            color={isCity ? "linear-gradient(90deg, #7cffb2, #f5f5f5, #8c8c8c)" : "linear-gradient(90deg, #f6b7c8, #a799e8)"}
          />
        </Card>
      </div>

      <Card title="Monthly Investing Chart" icon="✨">
        <InvestingChart data={data} effectiveActuals={effectiveActuals} />
      </Card>

      <Card title="Investing Table" icon={isCity ? "📊" : "🪴"}>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Roth</th>
                <th>Brokerage</th>
                <th>Total investing</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const actual = effectiveActuals[month];
                return (
                  <tr key={month}>
                    <td>{month}</td>
                    <td>{money(actual.roth)}</td>
                    <td>{money(actual.brokerage)}</td>
                    <td>{money(toNumber(actual.roth) + toNumber(actual.brokerage))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>YTD</td>
                <td>{money(totals.ytdRoth)}</td>
                <td>{money(totals.ytdBrokerage)}</td>
                <td>{money(totals.ytdInvesting)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </section>
  );
}

function Notes({ data, updateOwnerName, resetData, exportJson, importRef, importJson, isCity, isMountain }) {
  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Notes</span>
          <h2>Assumptions, backups, and gentle reality checks</h2>
        </div>
      </div>

      <Card title="Personalization" icon={isMountain ? "🏔️" : isCity ? ">" : "🌼"}>
        <div className="formGrid">
          <label className="field">
            <span>Name on the app</span>
            <input
              className="textInput"
              value={data.ownerName}
              placeholder="Gabby"
              onChange={(event) => updateOwnerName(event.target.value)}
              aria-label="Name shown in the app header"
            />
            <small>Updates the name chip across every theme.</small>
          </label>
        </div>
      </Card>

      <Card title={isCity ? "Terminal Notes" : "Garden Notes"} icon={isCity ? "$_" : "🌿"}>
        <ul className="noteList">
          <li>This is a planning tool, not financial advice.</li>
          <li>Data saves locally in this browser using localStorage.</li>
          <li>You can type directly into the site. You do not need to import or export for normal use.</li>
          <li>Use export/import JSON only to back up data or move it to another browser/device.</li>
          <li>Monthly actuals stay real until typed in or filled with a button.</li>
          <li>Use Fill repeating targets to copy Gym, Apple Storage, Roth IRA, and brokerage targets into the selected month.</li>
          <li>Changing a target updates future fills, but it does not rewrite old monthly actuals.</li>
          <li>The 2026 IRA limit defaults to $7,500 and can be edited.</li>
          <li>Unknown categories should be tracked first, then given realistic targets later.</li>
          <li>If she moves out or needs a car, revisit the cash reserve and monthly buffer.</li>
          <li>The softer Roth pace is intentional because she is not fully comfortable moving $7,500 all at once.</li>
          <li>The app is meant to help visibility and behavior, not create fake precision.</li>
        </ul>
      </Card>

      <Card title="Backup Tools" icon={isCity ? "💾" : "🪴"}>
        <div className="backupActions">
          <button className="softButton" onClick={exportJson}>Export JSON backup</button>
          <button className="softButton" onClick={() => importRef.current?.click()}>Import JSON backup</button>
          <button className="dangerButton" onClick={resetData}>Reset {isMountain ? "mountain" : isCity ? "terminal" : "garden"}</button>
          <input ref={importRef} className="hiddenFile" type="file" accept="application/json,.json" onChange={importJson} />
        </div>
      </Card>
    </section>
  );
}

function Card({ title, icon, children }) {
  return (
    <section className="card">
      <h3><span>{icon}</span>{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={strong ? "row strong" : "row"}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function SpendingChart({ categories, actuals, isCity }) {
  const palette = isCity
    ? ["#f5f5f5", "#7cffb2", "#b8b8b8", "#2f2f2f", "#dedede", "#4a4a4a", "#9a9a9a", "#1c1c1c", "#cfcfcf", "#5f5f5f", "#8fffc0"]
    : ["#f384ad", "#8bd5a4", "#a799e8", "#ffc39a", "#bfe7ff", "#ffe08a", "#d9cbff", "#ffb2c7", "#9fd9b0", "#f5c28d", "#c9b8d8"];
  const slices = categories
    .map((category, index) => ({
      ...category,
      value: toNumber(actuals[category.key]),
      color: palette[index % palette.length],
    }))
    .filter((category) => category.value > 0);
  const total = slices.reduce((sum, category) => sum + category.value, 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? slices
          .map((category) => {
            const start = cursor;
            const end = cursor + (category.value / total) * 100;
            cursor = end;
            return `${category.color} ${start}% ${end}%`;
          })
          .join(", ")
      : "#efe8f1 0% 100%";

  return (
    <div className="pieWrap">
      <div className="pieChart" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{money(total, true)}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="pieLegend">
        {(slices.length ? slices : categories.slice(0, 1)).map((category) => {
          const percent = total > 0 ? (category.value / total) * 100 : 0;
          return (
            <div className="pieLegendRow" key={category.key}>
              <i style={{ background: category.color || "#efe8f1" }} />
              <span>{categoryIcon(category, isCity)} {category.label}</span>
              <b>{total > 0 ? `${percent.toFixed(1)}%` : "0%"}</b>
              <em>{money(category.value || 0, true)}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TargetProgress({ categories, data, actuals, isCity }) {
  return (
    <div className="progressList">
      {categories.map((category) => {
        const actual = toNumber(actuals[category.key]);
        const target = toNumber(data.targets.categoryTargets[category.key]);
        const percent = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0;
        return (
          <div className="progressItem" key={category.key}>
            <div>
              <span>{categoryIcon(category, isCity)} {category.label}</span>
              <small>{target === 0 ? "Track first, set target later" : `${money(actual)} of ${money(target)}`}</small>
            </div>
            <ProgressBar
              value={percent}
              color={
                percent > 100
                  ? "#ef9a9a"
                  : isCity
                    ? "linear-gradient(90deg, #7cffb2, #f5f5f5, #8c8c8c)"
                    : "linear-gradient(90deg, #ffe08a, #8bd5a4)"
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function InvestingChart({ data, effectiveActuals }) {
  const monthlyTotals = months.map((month) => toNumber(effectiveActuals[month].roth) + toNumber(effectiveActuals[month].brokerage));
  const max = Math.max(...monthlyTotals, data.targets.rothMonthlyTarget + data.targets.brokerageTarget, 1);
  return (
    <div className="investChart" aria-label="Monthly investing bar chart">
      {months.map((month, index) => {
        const total = monthlyTotals[index];
        return (
          <div className="investColumn" key={month}>
            <div className="columnTrack">
              <span style={{ height: `${(total / max) * 100}%` }} />
            </div>
            <b>{month.slice(0, 3)}</b>
            <small>{money(total, true)}</small>
          </div>
        );
      })}
    </div>
  );
}

const styles = `
:root {
  --ink: #34283f;
  --muted: #6f6278;
  --outline: #4d385d;
  --deep: #72548f;
  --cream: #fff4c7;
  --paper: #fff9df;
  --panel: #fff1b8;
  --blush: #ffc7d9;
  --blush-strong: #f384ad;
  --lavender: #d9cbff;
  --lavender-strong: #8c76d8;
  --mint: #c9f2c4;
  --mint-strong: #5ebc79;
  --peach: #ffc39a;
  --blue: #bfe7ff;
  --yellow-input: #fff1a8;
  --danger: #e66b72;
  --shadow: 8px 8px 0 rgba(77, 56, 93, 0.2);
  --small-shadow: 4px 4px 0 rgba(77, 56, 93, 0.18);
  font-family: "Trebuchet MS", "Verdana", "Geneva", system-ui, sans-serif;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  min-width: 320px;
  background-color: #fbdfef;
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.34) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.34) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.34) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.34) 75%),
    linear-gradient(180deg, #ffe2ee 0%, #dcf7d9 58%, #bce8ff 100%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0, 0 0;
  background-size: 16px 16px, 16px 16px, 16px 16px, 16px 16px, auto;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: repeating-linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.16),
    rgba(255, 255, 255, 0.16) 1px,
    transparent 1px,
    transparent 5px
  );
  mix-blend-mode: soft-light;
}

button, input, select { font: inherit; }
button { cursor: pointer; }
.app {
  width: min(1180px, calc(100% - 28px));
  margin: 0 auto;
  padding: 24px 0 44px;
  position: relative;
  z-index: 2;
}
.gardenBg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.sun, .cloud, .sparkle {
  position: absolute;
  opacity: 0.78;
  image-rendering: pixelated;
  filter: drop-shadow(4px 4px 0 rgba(77, 56, 93, 0.16));
}
.sun { top: 24px; right: 7%; font-size: 54px; }
.cloudA { top: 92px; left: 7%; font-size: 42px; }
.cloudB { top: 245px; right: 10%; font-size: 34px; }
.sparkleA { top: 380px; left: 5%; font-size: 28px; }
.sparkleB { bottom: 48px; right: 8%; font-size: 30px; }

.hero {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  grid-template-rows: auto 1fr;
  gap: 24px;
  align-items: stretch;
  min-height: 430px;
  padding: 36px;
  border: 4px solid var(--outline);
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.17) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.17) 1px, transparent 1px),
    linear-gradient(180deg, #bdeaff 0 30%, #e8d8ff 30% 58%, #c9f2c4 58% 100%);
  background-size: 18px 18px, 18px 18px, auto;
  box-shadow: var(--shadow);
}
.hero::before {
  content: "";
  position: absolute;
  inset: 12px;
  pointer-events: none;
  border: 2px dashed rgba(77, 56, 93, 0.24);
  border-radius: 8px;
}
.heroCopy { align-self: center; max-width: 690px; position: relative; grid-column: 1; grid-row: 2; }
.heroTopline {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
}
.themeButtons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.themeSelectField {
  display: grid;
  gap: 5px;
  min-width: 190px;
}
.themeSelectField span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}
.themeSelect {
  min-width: 190px;
}
.kicker, .eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 6px 10px;
  border: 3px solid var(--outline);
  border-radius: 6px;
  color: #fff9df;
  background: var(--deep);
  box-shadow: 3px 3px 0 rgba(77, 56, 93, 0.18);
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0;
}
h1, h2, h3, p { margin-top: 0; }
h1 {
  margin: 12px 0 18px;
  font-size: clamp(3rem, 8.8vw, 6.7rem);
  line-height: 0.92;
  letter-spacing: 0;
  color: #fff9df;
  text-shadow:
    3px 0 var(--outline),
    -3px 0 var(--outline),
    0 3px var(--outline),
    0 -3px var(--outline),
    6px 6px 0 rgba(77, 56, 93, 0.28);
}
.tagline {
  display: inline-block;
  margin-bottom: 14px;
  padding: 8px 12px;
  border: 3px solid var(--outline);
  border-radius: 8px;
  color: #4c3a57;
  background: var(--cream);
  box-shadow: var(--small-shadow);
  font-size: clamp(1.08rem, 1.8vw, 1.35rem);
  font-weight: 900;
}
.heroCopy p:not(.tagline) {
  max-width: 660px;
  min-height: 92px;
  padding: 14px 16px;
  border: 3px solid var(--outline);
  border-radius: 10px;
  color: #56415f;
  background: rgba(255, 249, 223, 0.9);
  box-shadow: var(--small-shadow);
  font-size: 1.02rem;
  line-height: 1.58;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}
.badges span {
  padding: 9px 12px;
  border: 3px solid var(--outline);
  border-radius: 6px;
  background: var(--blush);
  box-shadow: 4px 4px 0 rgba(77, 56, 93, 0.2);
  font-weight: 900;
}
.badges span:nth-child(2) { background: var(--mint); }
.badges span:nth-child(3) { background: var(--lavender); }
.gameCard {
  grid-column: 2;
  grid-row: 2;
  align-self: center;
  min-height: 340px;
  padding: 18px;
  border: 4px solid var(--outline);
  border-radius: 12px;
  background:
    linear-gradient(90deg, rgba(77, 56, 93, 0.07) 1px, transparent 1px),
    linear-gradient(rgba(77, 56, 93, 0.07) 1px, transparent 1px),
    linear-gradient(180deg, #fff9df, #efe3ff);
  background-size: 14px 14px, 14px 14px, auto;
  box-shadow: inset 0 -8px 0 rgba(140, 118, 216, 0.22), 8px 8px 0 rgba(77, 56, 93, 0.22);
}
.gameTop, .sectionHeader, .actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.gameTop span { font-weight: 900; }
select {
  border: 3px solid var(--outline);
  border-radius: 6px;
  padding: 10px 12px;
  color: var(--ink);
  background: var(--yellow-input);
  box-shadow: inset 0 -3px 0 #f6d979, 4px 4px 0 rgba(77, 56, 93, 0.12);
}
.pixelGarden {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 12px;
  min-height: 140px;
  margin: 24px 0;
  padding: 18px;
  border: 4px solid var(--outline);
  border-radius: 8px;
  background:
    linear-gradient(to top, #8bdc8f 0 18%, #6fcf7a 18% 31%, transparent 31%),
    linear-gradient(90deg, rgba(77, 56, 93, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(77, 56, 93, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #bfe7ff 0 72%, #c9f2c4 72% 100%);
  background-size: auto, 16px 16px, 16px 16px, auto;
  box-shadow: inset 0 -6px 0 rgba(77, 56, 93, 0.12);
}
.pixelGarden span {
  font-size: clamp(2rem, 4vw, 3.1rem);
  transform: translateY(var(--y, 0));
  filter: drop-shadow(3px 3px 0 rgba(77, 56, 93, 0.2));
}
.pixelGarden span:nth-child(2n) { --y: -12px; }
.miniStats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.miniStats div, .statCard, .card {
  border: 4px solid var(--outline);
  background: var(--paper);
  box-shadow: var(--shadow);
}
.miniStats div {
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background: #fff7d4;
}
small, .miniStats small { color: var(--muted); }
.miniStats strong {
  display: block;
  margin-top: 4px;
  font-size: clamp(0.86rem, 1.7vw, 1.02rem);
  overflow-wrap: anywhere;
}

.nav {
  position: sticky;
  top: 10px;
  z-index: 4;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 18px 0;
  padding: 10px;
  border: 4px solid var(--outline);
  border-radius: 10px;
  background: rgba(255, 249, 223, 0.92);
  box-shadow: 6px 6px 0 rgba(77, 56, 93, 0.18);
}
.navMonth {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-left: 8px;
}
.navMonth span {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}
.navMonth select {
  min-width: 138px;
  padding: 9px 11px;
}
main {
  position: relative;
  z-index: 2;
}
.nav button, .softButton, .dangerButton, .themeToggle, .plainToggle {
  border: 3px solid var(--outline);
  border-radius: 7px;
  padding: 10px 14px;
  color: var(--ink);
  font-weight: 900;
  background: linear-gradient(180deg, #fff9df 0 52%, var(--mint) 52% 100%);
  box-shadow: 0 5px 0 #93c98c, 4px 4px 0 rgba(77, 56, 93, 0.13);
}
.nav button:hover, .softButton:hover, .dangerButton:hover, .themeToggle:hover, .plainToggle:hover {
  transform: translateY(1px);
  box-shadow: 0 4px 0 #93c98c, 3px 3px 0 rgba(77, 56, 93, 0.13);
}
.nav button.active {
  background: linear-gradient(180deg, #fff1a8 0 52%, var(--blush) 52% 100%);
  box-shadow: 0 5px 0 #d8869d, 4px 4px 0 rgba(77, 56, 93, 0.13);
}
.dangerButton {
  background: linear-gradient(180deg, #fff9df 0 52%, #ffc7ca 52% 100%);
  box-shadow: 0 5px 0 #d56b72, 4px 4px 0 rgba(77, 56, 93, 0.13);
}
.themeToggle {
  justify-self: end;
  min-width: 142px;
  min-height: 38px;
  padding-top: 6px;
  padding-bottom: 6px;
  background: linear-gradient(180deg, #fff9df 0 52%, var(--blue) 52% 100%);
  box-shadow: 0 5px 0 #79b8d8, 4px 4px 0 rgba(77, 56, 93, 0.13);
}
.plainToggle {
  min-width: 78px;
  min-height: 38px;
  padding: 6px 12px;
  background: linear-gradient(180deg, #fff, #f0f0f0);
  box-shadow: 0 5px 0 #bdbdbd, 4px 4px 0 rgba(77, 56, 93, 0.1);
}

.pageStack { display: grid; gap: 18px; }
.sectionHeader {
  align-items: end;
  padding: 8px 4px 0;
}
h2 {
  margin-bottom: 0;
  font-size: clamp(1.7rem, 4vw, 2.45rem);
  color: #fff9df;
  text-shadow:
    2px 0 var(--outline),
    -2px 0 var(--outline),
    0 2px var(--outline),
    0 -2px var(--outline),
    4px 4px 0 rgba(77, 56, 93, 0.2);
}
.statGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.statCard {
  min-width: 0;
  padding: 17px;
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgba(77, 56, 93, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(77, 56, 93, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, #fff9df, #ffe4ef);
  background-size: 12px 12px, 12px 12px, auto;
}
.statCard:nth-child(2) { background: linear-gradient(180deg, #fff9df, #d9f5d6); }
.statCard:nth-child(3) { background: linear-gradient(180deg, #fff9df, #e3d8ff); }
.statCard:nth-child(4) { background: linear-gradient(180deg, #fff9df, #ffe1bd); }
.statIcon { font-size: 1.8rem; margin-bottom: 10px; filter: drop-shadow(2px 2px 0 rgba(77, 56, 93, 0.16)); }
.statCard span { display: block; color: var(--muted); font-weight: 900; }
.statCard strong {
  display: block;
  margin-top: 6px;
  font-size: clamp(1.22rem, 2.5vw, 1.72rem);
  overflow-wrap: anywhere;
}
.statCard.good strong { color: #2f8651; }
.statCard.warning strong { color: #bd4e59; }
.grid { display: grid; gap: 18px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card {
  min-width: 0;
  padding: 18px;
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgba(77, 56, 93, 0.045) 1px, transparent 1px),
    linear-gradient(rgba(77, 56, 93, 0.045) 1px, transparent 1px),
    var(--paper);
  background-size: 14px 14px, 14px 14px, auto;
}
.card h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -2px -2px 16px;
  padding: 10px 12px;
  border: 3px solid var(--outline);
  border-radius: 7px;
  color: #fff9df;
  background: linear-gradient(180deg, var(--deep), #5b416f);
  box-shadow: 4px 4px 0 rgba(77, 56, 93, 0.14);
  font-size: 1.06rem;
}
.formGrid, .categoryTargetGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.categoryTargetGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.monthlyCategoryGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}
.monthlyCategoryColumn {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}
.monthlyCategoryCard {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 12px 16px 16px 12px;
  border: 2px dashed rgba(77, 56, 93, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.34);
}
.readonlyCategoryTotal {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.readonlyCategoryTotal span {
  color: #574462;
  font-size: 0.9rem;
  font-weight: 900;
}
.readonlyCategoryTotal strong {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 10px 12px;
  border: 3px solid var(--outline);
  border-radius: 7px;
  color: var(--ink);
  background: rgba(255, 249, 223, 0.72);
  box-shadow: inset 0 -4px 0 rgba(77, 56, 93, 0.1), 4px 4px 0 rgba(77, 56, 93, 0.1);
  font-size: 1.04rem;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.transactionList {
  display: grid;
  gap: 9px;
  min-height: 0;
  overflow: hidden;
  padding: 10px 8px 9px 0;
}
.transactionListWrap {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    grid-template-rows 220ms ease,
    opacity 180ms ease,
    transform 220ms ease;
}
.transactionListWrap.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}
.itemToolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
  gap: 8px;
}
.itemToggleButton,
.addItemButton {
  min-height: 38px;
  width: 100%;
}
.itemToggleButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding-left: 8px;
  padding-right: 8px;
}
.itemToggleButton span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.itemToggleIcon {
  display: inline-block;
  flex: 0 0 auto;
  font-weight: 900;
  transition: transform 180ms ease;
}
.itemToggleButton.expanded .itemToggleIcon {
  transform: rotate(90deg);
}
.itemToggleButton {
  background: linear-gradient(180deg, #fff9df 0 52%, var(--blush) 52% 100%);
  box-shadow: 0 5px 0 #d8869d, 4px 4px 0 rgba(77, 56, 93, 0.13);
}
.itemToggleButton:hover {
  box-shadow: 0 4px 0 #d8869d, 3px 3px 0 rgba(77, 56, 93, 0.13);
}
.transactionRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(108px, 0.72fr) auto;
  align-items: center;
  gap: 8px;
}
.transactionRow .textInput,
.transactionRow .inputShell {
  min-height: 44px;
}
.transactionName {
  width: 100%;
}
.transactionAmount input {
  padding-top: 9px;
  padding-bottom: 10px;
}
.removeItemButton {
  min-height: 44px;
}
.removeConfirmGroup {
  display: grid;
  grid-template-columns: repeat(2, minmax(38px, 1fr));
  gap: 6px;
}
.confirmRemoveButton,
.cancelRemoveButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding-left: 8px;
  padding-right: 8px;
  line-height: 1;
}
.confirmRemoveButton {
  color: #153b24;
  background: linear-gradient(180deg, #fff9df 0 52%, #8ee0a5 52% 100%);
  box-shadow: 0 5px 0 #4f9f65, 4px 4px 0 rgba(77, 56, 93, 0.13);
  font-size: 1.08rem;
}
.cancelRemoveButton {
  color: #5f1f27;
  background: linear-gradient(180deg, #fff9df 0 52%, #ff9aa4 52% 100%);
  box-shadow: 0 5px 0 #d56b72, 4px 4px 0 rgba(77, 56, 93, 0.13);
  font-size: 1.34rem;
}
.addItemButton {
  min-width: 0;
}
.field {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.field span {
  color: #574462;
  font-size: 0.9rem;
  font-weight: 900;
}
.inputShell {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 3px solid var(--outline);
  border-radius: 7px;
  background: var(--yellow-input);
  box-shadow: inset 0 -4px 0 #f4d773, 4px 4px 0 rgba(77, 56, 93, 0.11);
}
.inputShell:focus-within {
  background: #fff6bd;
  outline: 3px solid rgba(94, 188, 121, 0.36);
}
.inputShell b {
  padding-left: 12px;
  color: #715d2f;
}
input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 12px 12px 13px 7px;
  color: var(--ink);
  background: transparent;
  font-weight: 800;
}
.field small { min-height: 1rem; }

.categoryEditorList {
  display: grid;
  gap: 12px;
}
.categoryEditorRow {
  display: grid;
  grid-template-columns: 54px minmax(160px, 1fr) 120px 128px auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 2px dashed rgba(77, 56, 93, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.34);
}
.textInput,
.selectInput {
  min-width: 0;
  border: 3px solid var(--outline);
  border-radius: 7px;
  padding: 10px 11px;
  color: var(--ink);
  background: var(--yellow-input);
  box-shadow: inset 0 -3px 0 #f4d773, 3px 3px 0 rgba(77, 56, 93, 0.1);
  font-weight: 900;
}
.emojiInput {
  text-align: center;
  padding-left: 8px;
  padding-right: 8px;
}
.checkField {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  font-weight: 900;
  color: #574462;
}
.checkField input {
  width: auto;
  min-width: 18px;
  height: 18px;
  accent-color: var(--blush-strong);
}
.compactButton {
  padding: 9px 11px;
}
.addCategoryButton {
  width: fit-content;
  margin-top: 14px;
}

.pieWrap {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;
  gap: 16px;
}
.pieChart {
  display: grid;
  place-items: center;
  width: min(100%, 250px);
  aspect-ratio: 1;
  margin: 0 auto;
  border: 4px solid var(--outline);
  border-radius: 50%;
  box-shadow: var(--small-shadow);
}
.pieChart > div {
  display: grid;
  place-items: center;
  width: 42%;
  aspect-ratio: 1;
  border: 3px solid var(--outline);
  border-radius: 50%;
  color: var(--ink);
  background: var(--paper);
  text-align: center;
}
.pieChart strong {
  font-size: clamp(1rem, 2vw, 1.35rem);
  line-height: 1;
}
.pieChart span {
  color: var(--muted);
  font-weight: 900;
  font-size: 0.76rem;
}
.pieLegend, .progressList, .summaryList, .noteList { display: grid; gap: 12px; }
.pieLegend {
  width: min(100%, 560px);
}
.pieLegendRow {
  display: grid;
  grid-template-columns: 18px minmax(145px, 1fr) 64px 72px;
  align-items: center;
  gap: 9px;
  padding: 8px 0;
  border-bottom: 2px dotted rgba(77, 56, 93, 0.18);
}
.pieLegendRow:last-child {
  border-bottom: 0;
}
.pieLegendRow i {
  width: 16px;
  height: 16px;
  border: 2px solid var(--outline);
  border-radius: 4px;
  box-shadow: 2px 2px 0 rgba(77, 56, 93, 0.12);
}
.pieLegendRow span { color: #574462; font-weight: 900; }
.pieLegendRow b, .pieLegendRow em {
  justify-self: end;
  font-style: normal;
  font-weight: 900;
}
.progressTrack {
  height: 16px;
  overflow: hidden;
  border-radius: 4px;
  background:
    repeating-linear-gradient(90deg, #e1d7e8 0 8px, #d4c8dd 8px 16px);
  border: 3px solid var(--outline);
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.55);
}
.progressFill {
  display: block;
  height: 100%;
  border-radius: 0;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.26) 0 7px, transparent 7px 14px),
    linear-gradient(90deg, var(--blush-strong), var(--peach), var(--mint-strong));
}
.progressSummary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px;
  border: 3px solid var(--outline);
  border-radius: 8px;
  background: #fff7d4;
}
.progressItem {
  display: grid;
  grid-template-columns: minmax(190px, 0.85fr) minmax(130px, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 2px dashed rgba(77, 56, 93, 0.22);
  border-radius: 8px;
  background: rgba(255,255,255,0.36);
}
.progressItem span { display: block; font-weight: 900; }
.cashGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.cashGrid div {
  padding: 14px;
  border: 3px solid var(--outline);
  border-radius: 8px;
  background: linear-gradient(180deg, #fff9df 0 50%, #d9f5d6 50% 100%);
  box-shadow: var(--small-shadow);
}
.cashGrid span, .row span { display: block; color: var(--muted); font-weight: 900; }
.cashGrid strong { display: block; margin-top: 6px; font-size: 1.22rem; overflow-wrap: anywhere; }
.row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 3px dotted rgba(77, 56, 93, 0.18);
}
.row.strong {
  padding: 14px;
  border: 3px solid var(--outline);
  border-radius: 8px;
  background: var(--cream);
  box-shadow: var(--small-shadow);
}
.noteList {
  margin: 0;
  padding-left: 20px;
  color: #574462;
  line-height: 1.65;
}
.investChart {
  display: grid;
  grid-template-columns: repeat(12, minmax(54px, 1fr));
  gap: 10px;
  min-width: 720px;
  overflow: hidden;
}
.columnTrack {
  display: flex;
  align-items: end;
  height: 180px;
  padding: 5px;
  border: 3px solid var(--outline);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(77, 56, 93, 0.07) 1px, transparent 1px),
    linear-gradient(rgba(77, 56, 93, 0.07) 1px, transparent 1px),
    linear-gradient(180deg, #d9efff, #fff4c7);
  background-size: 12px 12px, 12px 12px, auto;
  box-shadow: inset 0 -4px 0 rgba(77, 56, 93, 0.1);
}
.columnTrack span {
  width: 100%;
  min-height: 4px;
  border-radius: 3px;
  border: 2px solid rgba(77, 56, 93, 0.28);
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.25) 0 6px, transparent 6px 12px),
    linear-gradient(180deg, var(--lavender-strong), var(--mint-strong));
}
.investColumn {
  display: grid;
  gap: 6px;
  text-align: center;
  color: var(--muted);
  font-weight: 900;
}
.investColumn b { color: var(--ink); }
.tableWrap {
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 640px;
  border-collapse: separate;
  border-spacing: 0;
  border: 3px solid var(--outline);
  border-radius: 8px;
  overflow: hidden;
  background: #fffdf0;
}
th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid rgba(77, 56, 93, 0.14);
}
th {
  color: #fff9df;
  background: var(--deep);
}
tbody tr:nth-child(even) td { background: #fff5d4; }
tfoot td { font-weight: 900; background: #c9f2c4; }
.backupActions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.hiddenFile { display: none; }

body[data-theme="money-mountain"] {
  color: #12314f;
  background-color: #45bfff;
  background-image:
    radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.78) 0 70px, transparent 72px),
    radial-gradient(circle at 76% 12%, rgba(255, 255, 255, 0.56) 0 54px, transparent 56px),
    radial-gradient(circle at 84% 58%, rgba(255, 255, 255, 0.42) 0 86px, transparent 88px),
    linear-gradient(180deg, #20aefe 0%, #55c7ff 36%, #91ddff 68%, #e8f8ff 100%);
  background-size: auto, auto, auto, auto;
}

body[data-theme="money-mountain"]::before {
  background:
    linear-gradient(120deg, transparent 0 58%, rgba(255, 255, 255, 0.22) 58% 60%, transparent 60% 100%),
    repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0.2) 1px,
      transparent 1px,
      transparent 10px
    );
  mix-blend-mode: soft-light;
  opacity: 0.86;
}

.app.moneyMountain {
  --ink: #12314f;
  --muted: #315f83;
  --outline: #16476b;
  --deep: #086ca8;
  --cream: #ffffff;
  --paper: rgba(255, 255, 255, 0.88);
  --panel: rgba(215, 242, 255, 0.84);
  --blush: #8bddff;
  --blush-strong: #0ea5e9;
  --lavender: #c5edff;
  --lavender-strong: #007cc2;
  --mint: #dff4e9;
  --mint-strong: #2f7d55;
  --peach: #c58b57;
  --blue: #38bdf8;
  --gold: #d39a5a;
  --orange: #a66a3d;
  --yellow-input: #ffffff;
  --danger: #d35d68;
  --shadow: 0 16px 0 rgba(17, 98, 148, 0.16), 0 28px 34px rgba(15, 84, 132, 0.24);
  --small-shadow: 0 8px 0 rgba(17, 98, 148, 0.14), 0 16px 20px rgba(15, 84, 132, 0.18);
}

.moneyMountain .sun,
.moneyMountain .cloud,
.moneyMountain .sparkle {
  opacity: 0.86;
  filter: drop-shadow(4px 4px 0 rgba(41, 68, 90, 0.12));
}

.moneyMountain .hero {
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.82) 0 58px, transparent 60px),
    radial-gradient(circle at 78% 24%, rgba(255, 255, 255, 0.54) 0 76px, transparent 78px),
    linear-gradient(180deg, #22b8ff 0 34%, #75d6ff 34% 66%, #f7fcff 66% 100%);
  box-shadow: var(--shadow);
}
.moneyMountain .hero > :not(.mountainSnow) {
  position: relative;
  z-index: 2;
}
.mountainSnow {
  display: none;
}
.moneyMountain .mountainSnow {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  pointer-events: none;
}
.mountainSnow span {
  position: absolute;
  top: -18px;
  left: var(--snow-x);
  width: var(--snow-size);
  height: var(--snow-size);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.58);
  animation: mountainSnowFall var(--snow-duration) linear infinite;
  animation-delay: var(--snow-delay);
}
@keyframes mountainSnowFall {
  0% {
    opacity: 0;
    transform: translate3d(0, -20px, 0) scale(0.72);
  }
  16% {
    opacity: 0.88;
  }
  82% {
    opacity: 0.58;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--snow-drift), 470px, 0) scale(1);
  }
}
.moneyMountain .hero::before {
  border-color: rgba(41, 68, 90, 0.24);
}
.moneyMountain .kicker,
.moneyMountain .eyebrow,
.moneyMountain .card h3 {
  color: #ffffff;
  background: linear-gradient(180deg, #3b85a8, #27516c);
  box-shadow: 0 8px 0 rgba(14, 92, 143, 0.2), 0 14px 20px rgba(15, 84, 132, 0.18);
}
.moneyMountain h1,
.moneyMountain h2 {
  color: #ffffff;
  text-shadow:
    2px 0 #29445a,
    -2px 0 #29445a,
    0 2px #29445a,
    0 -2px #29445a,
    5px 5px 0 rgba(89, 114, 135, 0.22);
}
.moneyMountain .tagline,
.moneyMountain .heroCopy p:not(.tagline),
.moneyMountain .badges span,
.moneyMountain .progressSummary,
.moneyMountain .row.strong,
.moneyMountain .cashGrid div {
  color: #18324a;
  background: rgba(255, 255, 255, 0.86);
  border-color: #29445a;
  box-shadow: var(--small-shadow);
}
.moneyMountain .badges span:nth-child(2) {
  background: #dff4e9;
}
.moneyMountain .badges span:nth-child(3) {
  background: #f4dfc8;
}
.moneyMountain .gameCard,
.moneyMountain .card,
.moneyMountain .statCard,
.moneyMountain .miniStats div {
  background:
    linear-gradient(90deg, rgba(14, 165, 233, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(14, 165, 233, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(205, 239, 255, 0.86));
  background-size: 14px 14px, 14px 14px, auto;
  border-color: #16476b;
  box-shadow: var(--shadow);
}
.moneyMountain .card {
  background: transparent;
  box-shadow: none;
}
.moneyMountain .statCard:nth-child(2) { background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(173, 232, 255, 0.9)); }
.moneyMountain .statCard:nth-child(3) { background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(221, 245, 255, 0.92)); }
.moneyMountain .statCard:nth-child(4) { background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(244, 223, 200, 0.9)); }
.moneyMountain .pixelGarden {
  background:
    radial-gradient(circle at 20% 18%, rgba(255,255,255,0.85) 0 34px, transparent 36px),
    linear-gradient(to top, #f8fcff 0 22%, transparent 22%),
    linear-gradient(180deg, #4fc6ff, #f9fdff);
}
.moneyMountain .pixelGarden span {
  filter: drop-shadow(3px 3px 0 rgba(41, 68, 90, 0.16));
}
.moneyMountain .nav,
.moneyMountain .monthlyCategoryCard,
.moneyMountain .categoryEditorRow,
.moneyMountain .progressItem {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(22, 71, 107, 0.28);
  box-shadow: var(--small-shadow);
}
.moneyMountain .nav {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
}
.moneyMountain .card {
  transform: translateY(-2px);
}
.moneyMountain .card:nth-child(2n),
.moneyMountain .statCard:nth-child(2n) {
  transform: translateY(2px);
}
.moneyMountain .nav button,
.moneyMountain .softButton,
.moneyMountain .dangerButton,
.moneyMountain .themeToggle,
.moneyMountain .plainToggle {
  color: #18324a;
  background: linear-gradient(180deg, #ffffff 0 52%, #38bdf8 52% 100%);
  box-shadow: 0 5px 0 #0284c7, 4px 4px 0 rgba(22, 71, 107, 0.14);
}
.moneyMountain .nav button.active,
.moneyMountain .itemToggleButton {
  color: #ffffff;
  background: linear-gradient(180deg, #0284c7 0 52%, #2f7d55 52% 100%);
  box-shadow: 0 5px 0 #245f43, 4px 4px 0 rgba(41, 68, 90, 0.14);
}
.moneyMountain .dangerButton,
.moneyMountain .cancelRemoveButton {
  color: #ffffff;
  background: linear-gradient(180deg, #c58b57 0 52%, #d35d68 52% 100%);
  box-shadow: 0 5px 0 #a64750, 4px 4px 0 rgba(41, 68, 90, 0.14);
}
.moneyMountain .confirmRemoveButton {
  color: #ffffff;
  background: linear-gradient(180deg, #64bde6 0 52%, #2f7d55 52% 100%);
  box-shadow: 0 5px 0 #245f43, 4px 4px 0 rgba(41, 68, 90, 0.14);
}
.moneyMountain select,
.moneyMountain .inputShell,
.moneyMountain .textInput,
.moneyMountain .selectInput,
.moneyMountain .readonlyCategoryTotal strong {
  color: #18324a;
  background: #ffffff;
  border-color: #29445a;
  box-shadow: inset 0 -4px 0 #b7e9ff, 4px 4px 0 rgba(22, 71, 107, 0.12);
}
.moneyMountain .inputShell:focus-within,
.moneyMountain .textInput:focus,
.moneyMountain .selectInput:focus,
.moneyMountain select:focus {
  background: #f8fcff;
  outline: 3px solid rgba(47, 125, 85, 0.28);
}
.moneyMountain .field span,
.moneyMountain .readonlyCategoryTotal span,
.moneyMountain .pieLegendRow span,
.moneyMountain .progressItem span,
.moneyMountain .checkField,
.moneyMountain .noteList {
  color: #18324a;
}
.moneyMountain small,
.moneyMountain .miniStats small,
.moneyMountain .cashGrid span,
.moneyMountain .row span,
.moneyMountain .investColumn,
.moneyMountain .navMonth span,
.moneyMountain .themeSelectField span {
  color: #587287;
}
.moneyMountain .progressFill,
.moneyMountain .columnTrack span {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 7px, transparent 7px 14px),
    linear-gradient(90deg, #0284c7, #38bdf8, #ffffff, #2f7d55);
}
.moneyMountain table {
  background: #ffffff;
}
.moneyMountain th {
  background: #27516c;
}
.moneyMountain tbody tr:nth-child(even) td {
  background: #edf8ff;
}
.moneyMountain tfoot td {
  color: #18324a;
  background: #dff4e9;
}

body[data-theme="dark-city"] {
  color: #f7edff;
  background-color: #120d24;
  background-image:
    linear-gradient(90deg, transparent 0 10px, rgba(255, 174, 66, 0.58) 10px 14px, transparent 14px 28px),
    linear-gradient(90deg, #24143b 0 28px, #17112d 28px 56px, #2e194d 56px 84px),
    linear-gradient(180deg, #0b1028 0%, #171138 38%, #30184c 72%, #161224 100%);
  background-position: 0 calc(100% - 130px), 0 bottom, 0 0;
  background-size: 84px 72px, 84px 150px, auto;
  background-repeat: repeat-x, repeat-x, no-repeat;
}

body[data-theme="dark-city"]::before {
  background:
    radial-gradient(circle at 16% 14%, rgba(255, 200, 87, 0.82) 0 2px, transparent 3px),
    radial-gradient(circle at 72% 9%, rgba(159, 239, 255, 0.8) 0 2px, transparent 3px),
    radial-gradient(circle at 88% 24%, rgba(255, 139, 196, 0.65) 0 2px, transparent 3px),
    repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.08),
      rgba(255, 255, 255, 0.08) 1px,
      transparent 1px,
      transparent 5px
    );
  mix-blend-mode: screen;
}

.app.darkCity {
  --ink: #f9edff;
  --muted: #c8b9da;
  --outline: #0a0715;
  --deep: #5e2ca5;
  --cream: #2a1b40;
  --paper: #1d1732;
  --panel: #24183b;
  --blush: #ff8bc4;
  --blush-strong: #ff5fab;
  --lavender: #7f69f2;
  --lavender-strong: #a18cff;
  --mint: #59d8ff;
  --mint-strong: #ff8bc4;
  --peach: #ffc857;
  --blue: #59d8ff;
  --gold: #ffc857;
  --orange: #ff9f43;
  --yellow-input: #d9f3ff;
  --danger: #ff6d7f;
  --shadow: 8px 8px 0 rgba(0, 0, 0, 0.44);
  --small-shadow: 4px 4px 0 rgba(0, 0, 0, 0.36);
}

.darkCity .sun { opacity: 0.9; filter: hue-rotate(185deg) saturate(1.4) drop-shadow(0 0 12px rgba(137, 224, 255, 0.55)); }
.darkCity .cloud { opacity: 0.55; filter: grayscale(0.3) brightness(0.9) drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.3)); }
.darkCity .sparkle { opacity: 0.92; filter: drop-shadow(0 0 10px rgba(255, 139, 196, 0.75)); }

.darkCity .hero {
  background:
    linear-gradient(90deg, rgba(89, 216, 255, 0.16) 1px, transparent 1px),
    linear-gradient(rgba(255, 200, 87, 0.12) 1px, transparent 1px),
    linear-gradient(180deg, #141a45 0 34%, #2a1550 34% 66%, #211836 66% 100%);
  background-size: 18px 18px, 18px 18px, auto;
  box-shadow: var(--shadow), 0 0 26px rgba(89, 216, 255, 0.22);
}
.darkCity .hero::before {
  border-color: rgba(89, 216, 255, 0.36);
}
.darkCity .kicker,
.darkCity .eyebrow {
  color: #090713;
  background: linear-gradient(180deg, #ffc857, #ff8bc4);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.38), 0 0 12px rgba(255, 174, 66, 0.45);
}
.darkCity h1,
.darkCity h2 {
  color: #f8f1ff;
  text-shadow:
    3px 0 #090713,
    -3px 0 #090713,
    0 3px #090713,
    0 -3px #090713,
    6px 6px 0 rgba(255, 95, 171, 0.28),
    0 0 18px rgba(89, 216, 255, 0.42);
}
.darkCity h2 {
  text-shadow:
    2px 0 #090713,
    -2px 0 #090713,
    0 2px #090713,
    0 -2px #090713,
    4px 4px 0 rgba(255, 95, 171, 0.24),
    0 0 12px rgba(89, 216, 255, 0.3);
}
.darkCity .tagline,
.darkCity .heroCopy p:not(.tagline) {
  color: #f9edff;
  background: rgba(29, 23, 50, 0.92);
  border-color: #090713;
}
.darkCity .badges span {
  color: #0b0714;
  background: #ff8bc4;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.38), 0 0 12px rgba(255, 139, 196, 0.28);
}
.darkCity .badges span:nth-child(2) { background: #ffc857; }
.darkCity .badges span:nth-child(3) { background: #59d8ff; }
.darkCity .gameCard,
.darkCity .card,
.darkCity .statCard,
.darkCity .miniStats div {
  background:
    linear-gradient(90deg, rgba(89, 216, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(255, 200, 87, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #24183b, #171226);
  background-size: 14px 14px, 14px 14px, auto;
  box-shadow: var(--shadow), 0 0 16px rgba(89, 216, 255, 0.12);
}
.darkCity .pixelGarden {
  background:
    linear-gradient(to top, #242238 0 18%, #3a2b55 18% 31%, transparent 31%),
    linear-gradient(90deg, rgba(89, 216, 255, 0.12) 1px, transparent 1px),
    linear-gradient(rgba(255, 200, 87, 0.12) 1px, transparent 1px),
    linear-gradient(180deg, #101a45 0 58%, #2b1745 58% 73%, #211836 73% 100%);
  background-size: auto, 16px 16px, 16px 16px, auto;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.3), 0 0 18px rgba(89, 216, 255, 0.16);
}
.darkCity .pixelGarden span {
  filter: drop-shadow(0 0 8px rgba(89, 216, 255, 0.55)) drop-shadow(3px 3px 0 rgba(0,0,0,0.45));
}
.darkCity .nav {
  background: rgba(18, 13, 36, 0.92);
  box-shadow: 6px 6px 0 rgba(0,0,0,0.38), 0 0 16px rgba(89, 216, 255, 0.14);
}
.darkCity .nav button,
.darkCity .softButton,
.darkCity .dangerButton,
.darkCity .themeToggle {
  color: #090713;
  background: linear-gradient(180deg, #f8f1ff 0 52%, #59d8ff 52% 100%);
  box-shadow: 0 5px 0 #2197bd, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .nav button.active {
  background: linear-gradient(180deg, #fff0a4 0 52%, #ffc857 52% 100%);
  box-shadow: 0 5px 0 #b86f20, 4px 4px 0 rgba(0,0,0,0.34), 0 0 14px rgba(255, 174, 66, 0.35);
}
.darkCity .themeToggle {
  background: linear-gradient(180deg, #fff4c1 0 52%, #ff9f43 52% 100%);
  box-shadow: 0 5px 0 #b86f20, 4px 4px 0 rgba(0,0,0,0.34), 0 0 12px rgba(255, 174, 66, 0.28);
}
.darkCity .dangerButton {
  background: linear-gradient(180deg, #f8f1ff 0 52%, #ff6d7f 52% 100%);
  box-shadow: 0 5px 0 #b83448, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity select,
.darkCity .inputShell {
  color: #25172f;
  background: var(--yellow-input);
  box-shadow: inset 0 -4px 0 #8ccce3, 4px 4px 0 rgba(0,0,0,0.28), 0 0 10px rgba(89, 216, 255, 0.2);
}
.darkCity .inputShell:focus-within {
  background: #e5f7ff;
  outline: 3px solid rgba(89, 216, 255, 0.42);
}
.darkCity input {
  color: #25172f;
}
.darkCity .field span,
.darkCity .pieLegendRow span,
.darkCity .progressItem span,
.darkCity .checkField,
.darkCity .noteList {
  color: #f3e7ff;
}
.darkCity .categoryEditorRow {
  border-color: rgba(255, 200, 87, 0.22);
  background: rgba(255, 255, 255, 0.04);
}
.darkCity .monthlyCategoryCard {
  border-color: rgba(255, 200, 87, 0.22);
  background: rgba(255, 255, 255, 0.04);
}
.darkCity .textInput,
.darkCity .selectInput {
  color: #25172f;
  background: var(--yellow-input);
  box-shadow: inset 0 -3px 0 #8ccce3, 3px 3px 0 rgba(0,0,0,0.24);
}
.darkCity .pieLegendRow {
  border-bottom-color: rgba(255, 200, 87, 0.22);
}
.darkCity small,
.darkCity .miniStats small,
.darkCity .cashGrid span,
.darkCity .row span,
.darkCity .investColumn {
  color: #c8b9da;
}
.darkCity .card h3 {
  color: #090713;
  background: linear-gradient(180deg, #59d8ff, #ffc857);
  box-shadow: 4px 4px 0 rgba(0,0,0,0.34), 0 0 12px rgba(255, 174, 66, 0.28);
}
.darkCity .statCard:nth-child(2),
.darkCity .statCard:nth-child(3),
.darkCity .statCard:nth-child(4) {
  background:
    linear-gradient(90deg, rgba(89, 216, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(255, 200, 87, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #24183b, #171226);
  background-size: 14px 14px, 14px 14px, auto;
}
.darkCity .statCard.good strong { color: #59d8ff; }
.darkCity .statCard.warning strong { color: #ff8c98; }
.darkCity .progressTrack {
  background: repeating-linear-gradient(90deg, #171226 0 8px, #24183b 8px 16px);
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.08);
}
.darkCity .progressFill {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 7px, transparent 7px 14px),
    linear-gradient(90deg, #ff5fab, #59d8ff, #ffc857, #ff9f43);
}
.darkCity .progressSummary,
.darkCity .row.strong,
.darkCity .cashGrid div {
  color: #f9edff;
  background: linear-gradient(180deg, #2a1b40 0 50%, #1d1732 50% 100%);
}
.darkCity .columnTrack {
  background:
    linear-gradient(90deg, rgba(89, 216, 255, 0.1) 1px, transparent 1px),
    linear-gradient(rgba(255, 200, 87, 0.1) 1px, transparent 1px),
    linear-gradient(180deg, #101a45, #241343);
  background-size: 12px 12px, 12px 12px, auto;
}
.darkCity .columnTrack span {
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0 6px, transparent 6px 12px),
    linear-gradient(180deg, #ff5fab, #59d8ff, #ffc857, #ff9f43);
}
.darkCity table {
  background: #1d1732;
}
.darkCity th {
  color: #090713;
  background: #59d8ff;
}
.darkCity td {
  color: #f9edff;
}
.darkCity tbody tr:nth-child(even) td { background: #24183b; }
.darkCity tfoot td {
  color: #090713;
  background: #ffc857;
}

body[data-theme="dark-city"] {
  color: #d8ffe8;
  background-color: #050807;
  background-image:
    linear-gradient(rgba(124, 255, 178, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124, 255, 178, 0.045) 1px, transparent 1px),
    radial-gradient(circle at 18% 12%, rgba(98, 214, 255, 0.1), transparent 28%),
    linear-gradient(180deg, #060909 0%, #0b1010 48%, #050807 100%);
  background-position: 0 0, 0 0, 0 0, 0 0;
  background-size: 26px 26px, 26px 26px, auto, auto;
  background-repeat: repeat, repeat, no-repeat, no-repeat;
}

body[data-theme="dark-city"]::before {
  background:
    repeating-linear-gradient(
      to bottom,
      rgba(124, 255, 178, 0.055),
      rgba(124, 255, 178, 0.055) 1px,
      transparent 1px,
      transparent 6px
    );
  mix-blend-mode: screen;
  opacity: 0.45;
}

.app.darkCity {
  --ink: #d8ffe8;
  --muted: #83a892;
  --outline: #1d2c25;
  --deep: #10251b;
  --cream: #101815;
  --paper: #0d1412;
  --panel: #111b17;
  --blush: #7cffb2;
  --blush-strong: #7cffb2;
  --lavender: #62d6ff;
  --lavender-strong: #62d6ff;
  --mint: #7cffb2;
  --mint-strong: #7cffb2;
  --peach: #d6ff7c;
  --blue: #62d6ff;
  --gold: #d6ff7c;
  --orange: #b7f36b;
  --yellow-input: #dfffee;
  --danger: #ff7a91;
  --shadow: 8px 8px 0 rgba(0, 0, 0, 0.56);
  --small-shadow: 4px 4px 0 rgba(0, 0, 0, 0.42);
  font-family: "OCR A Std", "OCR A Extended", "Share Tech Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", monospace;
  font-variant-numeric: tabular-nums;
}

.darkCity .sun,
.darkCity .cloud,
.darkCity .sparkle {
  color: #7cffb2;
  opacity: 0.16;
  filter: none;
  font-family: "OCR A Std", "OCR A Extended", "Share Tech Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", monospace;
}

.darkCity .hero {
  background:
    linear-gradient(90deg, rgba(124, 255, 178, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(124, 255, 178, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #0d1412, #09100e);
  background-size: 18px 18px, 18px 18px, auto;
  box-shadow: var(--shadow);
}
.darkCity .hero::before {
  border-color: rgba(124, 255, 178, 0.22);
}
.darkCity .kicker,
.darkCity .eyebrow {
  color: #7cffb2;
  background: #07100d;
  border-color: #254235;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.5);
}
.darkCity h1,
.darkCity h2 {
  color: #d8ffe8;
  text-shadow:
    2px 0 #030504,
    -2px 0 #030504,
    0 2px #030504,
    0 -2px #030504,
    0 0 16px rgba(124, 255, 178, 0.22);
}
.darkCity .tagline,
.darkCity .heroCopy p:not(.tagline) {
  color: #d8ffe8;
  background: #0b1210;
  border-color: #254235;
  box-shadow: var(--small-shadow);
}
.darkCity .badges span {
  color: #d8ffe8;
  background: #111b17;
  border-color: #254235;
  box-shadow: var(--small-shadow);
}
.darkCity .badges span:nth-child(2),
.darkCity .badges span:nth-child(3) {
  background: #111b17;
}
.darkCity .gameCard,
.darkCity .card,
.darkCity .statCard,
.darkCity .miniStats div {
  background:
    linear-gradient(90deg, rgba(124, 255, 178, 0.045) 1px, transparent 1px),
    linear-gradient(rgba(124, 255, 178, 0.045) 1px, transparent 1px),
    linear-gradient(180deg, #111b17, #0a100e);
  background-size: 16px 16px, 16px 16px, auto;
  border-color: #254235;
  box-shadow: var(--shadow);
}
.darkCity .pixelGarden {
  background:
    linear-gradient(to top, #08100d 0 28%, transparent 28%),
    linear-gradient(90deg, rgba(124, 255, 178, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(124, 255, 178, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #0d1412, #070d0b);
  background-size: auto, 16px 16px, 16px 16px, auto;
  border-color: #254235;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.36);
}
.darkCity .pixelGarden span {
  color: #7cffb2;
  filter: none;
  font-family: "OCR A Std", "OCR A Extended", "Share Tech Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", monospace;
  font-weight: 900;
}
.darkCity .nav {
  background: rgba(7, 13, 11, 0.94);
  border-color: #254235;
  box-shadow: var(--small-shadow);
}
.darkCity .nav button,
.darkCity .softButton,
.darkCity .dangerButton,
.darkCity .themeToggle {
  color: #d8ffe8;
  background: linear-gradient(180deg, #111b17 0 52%, #0b1210 52% 100%);
  border-color: #254235;
  box-shadow: 0 5px 0 #07100d, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .nav button.active,
.darkCity .themeToggle {
  color: #06100c;
  background: linear-gradient(180deg, #d8ffe8 0 52%, #7cffb2 52% 100%);
  box-shadow: 0 5px 0 #2e7b50, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .dangerButton {
  background: linear-gradient(180deg, #211116 0 52%, #3a151d 52% 100%);
  color: #ffdce3;
}
.darkCity select,
.darkCity .inputShell,
.darkCity .textInput,
.darkCity .selectInput {
  color: #06100c;
  background: var(--yellow-input);
  border-color: #254235;
  box-shadow: inset 0 -4px 0 #9dd8b6, 4px 4px 0 rgba(0,0,0,0.28);
}
.darkCity .inputShell:focus-within {
  background: #effff6;
  outline: 3px solid rgba(124, 255, 178, 0.28);
}
.darkCity input {
  color: #06100c;
}
.darkCity .field span,
.darkCity .pieLegendRow span,
.darkCity .progressItem span,
.darkCity .checkField,
.darkCity .noteList {
  color: #d8ffe8;
}
.darkCity .categoryEditorRow {
  border-color: rgba(124, 255, 178, 0.18);
  background: rgba(124, 255, 178, 0.035);
}
.darkCity .monthlyCategoryCard {
  border-color: rgba(124, 255, 178, 0.18);
  background: rgba(124, 255, 178, 0.035);
}
.darkCity .pieLegendRow {
  border-bottom-color: rgba(124, 255, 178, 0.16);
}
.darkCity small,
.darkCity .miniStats small,
.darkCity .cashGrid span,
.darkCity .row span,
.darkCity .investColumn {
  color: #83a892;
}
.darkCity .card h3 {
  color: #7cffb2;
  background: #07100d;
  border-color: #254235;
  box-shadow: var(--small-shadow);
}
.darkCity .statCard.good strong { color: #7cffb2; }
.darkCity .statCard.warning strong { color: #ff8fa3; }
.darkCity .progressTrack {
  background: repeating-linear-gradient(90deg, #07100d 0 8px, #101815 8px 16px);
  border-color: #254235;
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.04);
}
.darkCity .progressFill {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 7px, transparent 7px 14px),
    linear-gradient(90deg, #7cffb2, #62d6ff, #d6ff7c);
}
.darkCity .progressSummary,
.darkCity .row.strong,
.darkCity .cashGrid div {
  color: #d8ffe8;
  background: #0b1210;
  border-color: #254235;
}
.darkCity .columnTrack {
  background:
    linear-gradient(90deg, rgba(124, 255, 178, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(124, 255, 178, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, #0d1412, #07100d);
  background-size: 12px 12px, 12px 12px, auto;
  border-color: #254235;
}
.darkCity .columnTrack span {
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 12px),
    linear-gradient(180deg, #7cffb2, #62d6ff);
}
.darkCity table {
  background: #0d1412;
  border-color: #254235;
}
.darkCity th {
  color: #7cffb2;
  background: #07100d;
}
.darkCity td {
  color: #d8ffe8;
}
.darkCity tbody tr:nth-child(even) td { background: #101815; }
.darkCity tfoot td {
  color: #06100c;
  background: #7cffb2;
}

/* Terminal contrast pass: black/white first, green only as accent. */
body[data-theme="dark-city"] {
  color: #f4f4f4;
  background-color: #0b0d0c;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(180deg, #0b0d0c 0%, #121514 100%);
}

body[data-theme="dark-city"]::before {
  background:
    repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.04),
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 7px
    );
  opacity: 0.38;
}

.app.darkCity {
  --ink: #f4f4f4;
  --muted: #b8b8b8;
  --outline: #3a3a3a;
  --deep: #171a19;
  --cream: #171a19;
  --paper: #141716;
  --panel: #1b1f1d;
  --blush: #7cffb2;
  --blush-strong: #7cffb2;
  --lavender: #e8e8e8;
  --lavender-strong: #f4f4f4;
  --mint: #7cffb2;
  --mint-strong: #7cffb2;
  --peach: #d2d2d2;
  --blue: #f4f4f4;
  --gold: #d2d2d2;
  --orange: #a8a8a8;
  --yellow-input: #eef2ef;
  --danger: #ff8fa3;
}

.darkCity .hero,
.darkCity .gameCard,
.darkCity .card,
.darkCity .statCard,
.darkCity .miniStats div {
  color: #f4f4f4;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(180deg, #1a1e1c, #111412);
  border-color: #3a3a3a;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.62);
}

.darkCity .hero::before {
  border-color: rgba(124, 255, 178, 0.22);
}

.darkCity .tagline,
.darkCity .heroCopy p:not(.tagline),
.darkCity .badges span,
.darkCity .progressSummary,
.darkCity .row.strong,
.darkCity .cashGrid div {
  color: #f4f4f4;
  background: #1a1e1c;
  border-color: #3a3a3a;
}

.darkCity .kicker,
.darkCity .eyebrow,
.darkCity .card h3,
.darkCity th {
  color: #7cffb2;
  background: #101311;
  border-color: #3a3a3a;
}

.darkCity h1,
.darkCity h2 {
  color: #ffffff;
  text-shadow:
    2px 0 #000,
    -2px 0 #000,
    0 2px #000,
    0 -2px #000,
    0 0 12px rgba(124, 255, 178, 0.16);
}
.darkCity h1 {
  color: #050505;
  text-shadow:
    3px 0 #f4f4f4,
    -3px 0 #f4f4f4,
    0 3px #f4f4f4,
    0 -3px #f4f4f4,
    6px 6px 0 rgba(0, 0, 0, 0.55);
}

.darkCity .nav,
.darkCity table,
.darkCity .pixelGarden,
.darkCity .columnTrack {
  background: #151817;
  border-color: #3a3a3a;
}

.darkCity .nav button,
.darkCity .softButton,
.darkCity .dangerButton,
.darkCity .themeToggle {
  color: #f4f4f4;
  background: linear-gradient(180deg, #222624 0 52%, #181c1a 52% 100%);
  border-color: #3a3a3a;
  box-shadow: 0 5px 0 #050505, 4px 4px 0 rgba(0,0,0,0.34);
}

.darkCity .nav button.active,
.darkCity .themeToggle {
  color: #050505;
  background: linear-gradient(180deg, #f4f4f4 0 52%, #7cffb2 52% 100%);
}
.darkCity .confirmRemoveButton {
  color: #050505;
  background: linear-gradient(180deg, #f4f4f4 0 52%, #7cffb2 52% 100%);
  box-shadow: 0 5px 0 #2e7b50, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .cancelRemoveButton {
  color: #ffffff;
  background: linear-gradient(180deg, #3a151d 0 52%, #ff7a91 52% 100%);
  box-shadow: 0 5px 0 #8d2635, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .itemToggleButton {
  color: #050505;
  background: linear-gradient(180deg, #f4f4f4 0 52%, #a7ffd0 52% 100%);
  box-shadow: 0 5px 0 #4aa16e, 4px 4px 0 rgba(0,0,0,0.34);
}
.darkCity .itemToggleButton:hover {
  box-shadow: 0 4px 0 #4aa16e, 3px 3px 0 rgba(0,0,0,0.34);
}

.darkCity .plainToggle {
  color: #f4f4f4;
  background: linear-gradient(180deg, #222624 0 52%, #101311 52% 100%);
  border-color: #3a3a3a;
  box-shadow: 0 5px 0 #050505, 4px 4px 0 rgba(0,0,0,0.34);
}

.darkCity .field span,
.darkCity .pieLegendRow span,
.darkCity .progressItem span,
.darkCity .checkField,
.darkCity .noteList,
.darkCity td {
  color: #f4f4f4;
}

.darkCity small,
.darkCity .miniStats small,
.darkCity .cashGrid span,
.darkCity .row span,
.darkCity .investColumn,
.darkCity .progressItem small,
.darkCity .navMonth span {
  color: #c8c8c8;
}

.darkCity .progressItem {
  color: #f4f4f4;
  background: #181c1a;
  border: 2px solid #333333;
}

.darkCity .progressTrack {
  background: repeating-linear-gradient(90deg, #111412 0 8px, #222624 8px 16px);
  border-color: #3a3a3a;
}

.darkCity .progressFill,
.darkCity .columnTrack span {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 7px, transparent 7px 14px),
    linear-gradient(90deg, #7cffb2, #f4f4f4, #8c8c8c);
}

.darkCity select,
.darkCity .inputShell,
.darkCity .textInput,
.darkCity .selectInput {
  color: #f4f4f4;
  background: #101311;
  border-color: #3a3a3a;
  box-shadow: inset 0 -4px 0 #050505, 4px 4px 0 rgba(0,0,0,0.28);
}

.darkCity input,
.darkCity .textInput,
.darkCity .selectInput,
.darkCity select {
  color: #f4f4f4;
}

.darkCity .inputShell b {
  color: #7cffb2;
}

.darkCity .inputShell:focus-within,
.darkCity .textInput:focus,
.darkCity .selectInput:focus,
.darkCity select:focus {
  background: #181c1a;
  outline: 3px solid rgba(124, 255, 178, 0.28);
}

.darkCity input::placeholder,
.darkCity .textInput::placeholder {
  color: #8c8c8c;
}

.darkCity .pieLegendRow,
.darkCity .categoryEditorRow,
.darkCity .monthlyCategoryCard {
  border-color: rgba(255, 255, 255, 0.16);
}
.darkCity .readonlyCategoryTotal span {
  color: #f4f4f4;
}
.darkCity .readonlyCategoryTotal strong {
  color: #f4f4f4;
  background: #101311;
  border-color: #3a3a3a;
  box-shadow: inset 0 -4px 0 #050505, 4px 4px 0 rgba(0,0,0,0.28);
}

.darkCity .pieLegendRow {
  border-bottom-color: rgba(255, 255, 255, 0.16);
}

.darkCity tbody tr:nth-child(even) td {
  background: #202422;
}

.darkCity tfoot td {
  color: #050505;
  background: #7cffb2;
}

body[data-theme="plain"] {
  color: #1f2933;
  background: #f5f6f8;
}

body[data-theme="plain"]::before {
  display: none;
}

.app.plainTheme {
  --ink: #1f2933;
  --muted: #65727f;
  --outline: #d7dde3;
  --deep: #334155;
  --cream: #ffffff;
  --paper: #ffffff;
  --panel: #f8fafc;
  --blush: #f1f5f9;
  --blush-strong: #64748b;
  --lavender: #f1f5f9;
  --lavender-strong: #64748b;
  --mint: #eef2f7;
  --mint-strong: #475569;
  --peach: #f1f5f9;
  --blue: #e8eef5;
  --yellow-input: #ffffff;
  --danger: #b42318;
  --shadow: none;
  --small-shadow: none;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.plainTheme .gardenBg,
.plainTheme .hero::before {
  display: none;
}

.plainTheme .hero,
.plainTheme .gameCard,
.plainTheme .card,
.plainTheme .statCard,
.plainTheme .miniStats div,
.plainTheme .nav {
  color: #1f2933;
  background: #ffffff;
  background-image: none;
  border: 1px solid #d7dde3;
  border-radius: 10px;
  box-shadow: none;
}

.plainTheme .hero {
  min-height: 360px;
}

.plainTheme .statIcon,
.plainTheme .card h3 > span,
.plainTheme .pixelGarden {
  display: none;
}

.plainTheme .gameCard {
  display: grid;
  grid-template-rows: auto 1fr;
}

.plainTheme .miniStats {
  align-self: center;
}

.plainTheme .kicker,
.plainTheme .eyebrow,
.plainTheme .card h3 {
  color: #334155;
  background: #f8fafc;
  border: 1px solid #d7dde3;
  border-radius: 8px;
  box-shadow: none;
  font-weight: 600;
}

.plainTheme h1,
.plainTheme h2 {
  color: #111827;
  text-shadow: none;
  font-weight: 700;
}

.plainTheme .statCard strong {
  font-size: clamp(1rem, 1.8vw, 1.28rem);
}

.plainTheme .tagline,
.plainTheme .heroCopy p:not(.tagline),
.plainTheme .badges span,
.plainTheme .progressSummary,
.plainTheme .row.strong,
.plainTheme .cashGrid div,
.plainTheme .categoryEditorRow,
.plainTheme .monthlyCategoryCard {
  color: #1f2933;
  background: #f8fafc;
  border: 1px solid #d7dde3;
  box-shadow: none;
}

.plainTheme .nav {
  backdrop-filter: none;
}

.plainTheme .nav button,
.plainTheme .softButton,
.plainTheme .dangerButton,
.plainTheme .themeToggle,
.plainTheme .plainToggle {
  color: #1f2933;
  background: #ffffff;
  border: 1px solid #cfd7df;
  border-radius: 8px;
  box-shadow: none;
  font-weight: 600;
}

.plainTheme .nav button:hover,
.plainTheme .softButton:hover,
.plainTheme .dangerButton:hover,
.plainTheme .themeToggle:hover,
.plainTheme .plainToggle:hover {
  transform: none;
  background: #f8fafc;
  box-shadow: none;
}

.plainTheme .nav button.active,
.plainTheme .plainToggle {
  color: #ffffff;
  background: #334155;
  border-color: #334155;
}
.plainTheme .confirmRemoveButton {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.plainTheme .cancelRemoveButton {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.plainTheme .itemToggleButton {
  color: #334155;
  background: #eef2f7;
  border-color: #b9c4cf;
}
.plainTheme .itemToggleButton:hover {
  background: #e2e8f0;
}

.plainTheme .plainToggle:hover {
  color: #ffffff;
  background: #263445;
  border-color: #263445;
}

.plainTheme .dangerButton {
  color: #b42318;
}

.plainTheme .inputShell,
.plainTheme select,
.plainTheme .textInput,
.plainTheme .selectInput {
  color: #1f2933;
  background: #ffffff;
  border: 1px solid #cfd7df;
  border-radius: 8px;
  box-shadow: none;
}

.plainTheme input,
.plainTheme .textInput,
.plainTheme .selectInput,
.plainTheme select {
  color: #1f2933;
  font-weight: 500;
}

.plainTheme .inputShell:focus-within,
.plainTheme .textInput:focus,
.plainTheme .selectInput:focus,
.plainTheme select:focus {
  outline: 2px solid #94a3b8;
  background: #ffffff;
}

.plainTheme .inputShell b,
.plainTheme small,
.plainTheme .miniStats small,
.plainTheme .cashGrid span,
.plainTheme .row span,
.plainTheme .investColumn,
.plainTheme .progressItem small,
.plainTheme .navMonth span {
  color: #65727f;
}

.plainTheme .field span,
.plainTheme .pieLegendRow span,
.plainTheme .progressItem span,
.plainTheme .checkField,
.plainTheme .noteList,
.plainTheme td {
  color: #1f2933;
}

.plainTheme .tagline,
.plainTheme .badges span,
.plainTheme .gameTop span,
.plainTheme .statCard span,
.plainTheme .statCard strong,
.plainTheme .miniStats strong,
.plainTheme .field span,
.plainTheme .readonlyCategoryTotal span,
.plainTheme .readonlyCategoryTotal strong,
.plainTheme .pieLegendRow span,
.plainTheme .pieLegendRow b,
.plainTheme .pieLegendRow em,
.plainTheme .progressItem span,
.plainTheme .cashGrid span,
.plainTheme .cashGrid strong,
.plainTheme .row span,
.plainTheme .row strong,
.plainTheme .checkField,
.plainTheme .investColumn,
.plainTheme tfoot td {
  font-weight: 600;
}

.plainTheme .heroCopy p:not(.tagline),
.plainTheme .noteList,
.plainTheme td {
  font-weight: 400;
}

.plainTheme th {
  font-weight: 600;
}

.plainTheme .readonlyCategoryTotal span {
  color: #1f2933;
}
.plainTheme .readonlyCategoryTotal strong {
  color: #1f2933;
  background: #ffffff;
  border: 1px solid #cfd7df;
  box-shadow: none;
  font-size: 1rem;
}

.plainTheme .progressItem {
  background: #ffffff;
  border: 1px solid #e1e7ee;
}

.plainTheme .progressTrack,
.plainTheme .columnTrack {
  background: #e8eef5;
  border: 1px solid #d7dde3;
  box-shadow: none;
}

.plainTheme .progressFill,
.plainTheme .columnTrack span {
  background: #64748b;
}

.plainTheme .pieChart,
.plainTheme .pieChart > div,
.plainTheme .pieLegendRow i,
.plainTheme table {
  border-color: #d7dde3;
  box-shadow: none;
}

.plainTheme .pieLegendRow {
  border-bottom-color: #e1e7ee;
}

.plainTheme th {
  color: #1f2933;
  background: #f1f5f9;
}

.plainTheme tbody tr:nth-child(even) td {
  background: #f8fafc;
}

.plainTheme tfoot td {
  color: #1f2933;
  background: #eef2f7;
}

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; padding: 30px; }
  .heroTopline, .heroCopy, .gameCard { grid-column: 1; }
  .heroTopline { grid-row: 1; }
  .heroCopy { grid-row: 2; }
  .gameCard { grid-row: 3; }
  .statGrid { grid-template-columns: repeat(2, 1fr); }
  .grid.two { grid-template-columns: 1fr; }
  .categoryTargetGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .monthlyCategoryGrid { grid-template-columns: 1fr; }
}

@media (max-width: 620px) {
  .app { width: min(100% - 18px, 1180px); padding-top: 10px; }
  .hero { min-height: auto; padding: 18px; border-radius: 10px; }
  .badges span, .nav button, .softButton, .dangerButton, .themeToggle, .plainToggle { width: 100%; text-align: center; }
  .navMonth { width: 100%; margin-left: 0; padding-left: 0; justify-content: space-between; }
  .navMonth select { flex: 1; min-width: 0; }
  .heroTopline { align-items: stretch; flex-direction: column; }
  .themeButtons { flex-direction: column; align-items: stretch; }
  .themeSelectField,
  .themeSelect { width: 100%; min-width: 0; }
  .gameTop, .sectionHeader, .actions, .progressSummary { align-items: stretch; flex-direction: column; }
  .miniStats, .statGrid, .formGrid, .categoryTargetGrid, .cashGrid { grid-template-columns: 1fr; }
  .transactionRow { grid-template-columns: 1fr; }
  .addItemButton,
  .removeItemButton,
  .removeConfirmGroup { width: 100%; }
  .categoryEditorRow { grid-template-columns: 54px minmax(0, 1fr); }
  .categoryEditorRow .selectInput,
  .categoryEditorRow .checkField,
  .categoryEditorRow .compactButton { grid-column: 1 / -1; }
  .addCategoryButton { width: 100%; }
  .pieLegend { overflow-x: auto; }
  .pieLegendRow { grid-template-columns: 18px 165px 64px 72px; min-width: 340px; }
  .investChart { overflow-x: auto; }
  .progressItem { grid-template-columns: 1fr; }
  .card { padding: 14px; border-radius: 9px; }
  h1 { font-size: clamp(3rem, 18vw, 4.7rem); }
}
`;

export default App;
