import crypto from "crypto";

export const generateOrderId = () => {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, ""); // YYYYMMDD

  const randomPart = crypto
    .randomBytes(3) // 3 bytes = 6 hex chars
    .toString("hex")
    .toUpperCase();

  return `ORD-${datePart}-${randomPart}`;
};
