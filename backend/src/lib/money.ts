// Money is stored internally as integer paise to avoid floating-point error.
// The wire format is a decimal string in rupees (e.g. "1234.50") so clients
// never have to deal with paise themselves and JSON precision is preserved.

const MAX_PAISE = Number.MAX_SAFE_INTEGER; // ~9e15 paise = ~9e13 rupees

export function rupeesToPaise(input: string | number): number {
  const s = typeof input === "number" ? input.toString() : input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("amount must be a decimal with up to 2 fractional digits");
  }
  const [whole, frac = ""] = s.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const wholeAbs = whole.replace("-", "");
  const paddedFrac = (frac + "00").slice(0, 2);
  const paise = sign * (Number(wholeAbs) * 100 + Number(paddedFrac));
  if (!Number.isFinite(paise) || Math.abs(paise) > MAX_PAISE) {
    throw new Error("amount out of range");
  }
  return paise;
}

export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${frac.toString().padStart(2, "0")}`;
}
