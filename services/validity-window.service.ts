export function isWithinValidityWindow(validAfter: Date, validBefore: Date, now = new Date()): boolean {
  return now >= validAfter && now <= validBefore
}
