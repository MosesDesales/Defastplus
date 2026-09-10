/** Label synonyms for Indian GST invoice key-value extraction. */

export const INVOICE_NO_LABELS =
  /\b(?:tax\s*invoice\s*(?:no\.?|number|#)|invoice\s*(?:no\.?|number|#)|bill\s*(?:no\.?|number|#)|document\s*(?:no\.?|number|#)|inv\.?\s*no\.?|bill\s*#)\s*[.:]?\s*/i;

export const INVOICE_DATE_LABELS =
  /\b(?:invoice\s*date|date\s*of\s*(?:issue|invoice|supply)|bill\s*date|issue\s*date|dated)\s*[.:]?\s*/i;

export const DUE_DATE_LABELS = /\b(?:due\s*date|payment\s*due|pay\s*by|due\s*on)\s*[.:]?\s*/i;

export const PO_LABELS = /\b(?:p\.?\s*o\.?\s*(?:no\.?|number|#)|purchase\s*order\s*(?:no\.?|number|#))\s*[.:]?\s*/i;

export const EWAY_LABELS = /\b(?:e-?\s*way\s*bill\s*(?:no\.?|number|#)?|eway\s*(?:no\.?|#))\s*[.:]?\s*/i;

export const PLACE_OF_SUPPLY_LABELS = /\b(?:place\s*of\s*supply|pos)\s*[.:]?\s*/i;

export const TAXABLE_VALUE_LABELS = /\b(?:taxable\s*(?:value|amount)|value\s*before\s*tax)\s*[.:]?\s*/i;

export const SUBTOTAL_LABELS = /\b(?:sub\s*-?\s*total|subtotal)\s*[.:]?\s*/i;

export const DISCOUNT_LABELS = /\b(?:discount|less\s*discount)\s*[.:]?\s*/i;

export const ROUND_OFF_LABELS = /\b(?:round\s*off|rounding)\s*[.:]?\s*/i;

export const GRAND_TOTAL_LABELS =
  /\b(?:grand\s*total|total\s*amount|invoice\s*total|net\s*payable|amount\s*payable|total\s*due|balance\s*due|amount\s*due)\s*[.:]?\s*/i;

export const AMOUNT_PAID_LABELS = /\b(?:amount\s*paid|paid\s*amount|payment\s*received)\s*[.:]?\s*/i;

export const BALANCE_LABELS = /\b(?:balance\s*(?:amount|due)?|outstanding)\s*[.:]?\s*/i;

export const CGST_LABELS = /\b(?:cgst|central\s*gst)\s*(?:@\s*[\d.]+\s*%?)?\s*[.:]?\s*/i;

export const SGST_LABELS = /\b(?:sgst|state\s*gst|utgst)\s*(?:@\s*[\d.]+\s*%?)?\s*[.:]?\s*/i;

export const IGST_LABELS = /\b(?:igst|integrated\s*gst)\s*(?:@\s*[\d.]+\s*%?)?\s*[.:]?\s*/i;

export const CESS_LABELS = /\b(?:cess|compensation\s*cess)\s*[.:]?\s*/i;

export const TCS_LABELS = /\b(?:tcs|tax\s*collected\s*at\s*source)\s*[.:]?\s*/i;

export const TDS_LABELS = /\b(?:tds|tax\s*deducted\s*at\s*source)\s*[.:]?\s*/i;

export const SUPPLIER_LABELS =
  /\b(?:supplier|vendor|seller|from|sold\s*by|consignor|merchant)\s*(?:name|details)?\s*[.:]?\s*/i;

export const BUYER_LABELS = /\b(?:buyer|bill\s*to|ship\s*to|customer|consignee|recipient)\s*(?:name|details)?\s*[.:]?\s*/i;

export const PAN_LABELS = /\b(?:pan\s*(?:no\.?|number|#)?)\s*[.:]?\s*/i;

export const GSTIN_LABELS = /\b(?:gstin|gst\s*(?:in|no\.?|number|#|registration))\s*[.:]?\s*/i;

export const PHONE_LABELS = /\b(?:phone|mobile|tel|contact\s*no\.?|mob\.?)\s*[.:]?\s*/i;

export const EMAIL_LABELS = /\b(?:e-?mail|email\s*id)\s*[.:]?\s*/i;

/** HSN/SAC column header detection. */
export const HSN_HEADER = /\b(?:hsn|sac|hsn\/sac)\b/i;

export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};
