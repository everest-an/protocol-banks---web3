export type CardStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'PENDING'

export function normalizeCardStatus(raw: unknown): CardStatus {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'active') return 'ACTIVE'
  if (value === 'frozen' || value === 'inactive') return 'FROZEN'
  if (value === 'terminated' || value === 'closed') return 'CLOSED'
  if (value === 'pending') return 'PENDING'
  return 'PENDING'
}

export function isCardClosed(raw: unknown): boolean {
  return normalizeCardStatus(raw) === 'CLOSED'
}
