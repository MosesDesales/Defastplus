export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OR", name: "Odisha" },
  { code: "PY", name: "Puducherry" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
];

export const INDUSTRIES = [
  "Travel / Hospitality",
  "Technology / IT",
  "Manufacturing",
  "Retail",
  "Professional Services",
  "Healthcare",
  "Education",
  "Construction",
  "Agriculture",
  "Finance & Insurance",
  "Other",
] as const;

export const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "OTHER", name: "Other" },
] as const;

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(GMT+5:30) India Standard Time — Asia/Kolkata" },
  { value: "Asia/Dubai", label: "(GMT+4) Gulf — Asia/Dubai" },
  { value: "Asia/Singapore", label: "(GMT+8) Singapore — Asia/Singapore" },
  { value: "Europe/London", label: "(GMT+0/+1) United Kingdom — Europe/London" },
  { value: "America/New_York", label: "(GMT-5/-4) US Eastern — America/New_York" },
  { value: "America/Los_Angeles", label: "(GMT-8/-7) US Pacific — America/Los_Angeles" },
  { value: "UTC", label: "UTC" },
] as const;

export const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;

export const FISCAL_START_MONTHS: { label: string; month: number }[] = [
  { label: "April – March (India)", month: 4 },
  { label: "January – December", month: 1 },
  { label: "July – June", month: 7 },
];

export const UI_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
] as const;
