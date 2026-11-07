import { normalizeCardStatus, isCardClosed } from '../services/card-status'

describe('card status normalization', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['ACTIVE', 'ACTIVE'],
    ['frozen', 'FROZEN'],
    ['inactive', 'FROZEN'],
    ['terminated', 'CLOSED'],
    ['closed', 'CLOSED'],
    ['pending', 'PENDING'],
    [null, 'PENDING'],
    [undefined, 'PENDING'],
    ['unexpected', 'PENDING'],
  ])('maps %p to %p', (input, expected) => {
    expect(normalizeCardStatus(input)).toBe(expected)
  })

  it('treats terminated and closed as closed', () => {
    expect(isCardClosed('terminated')).toBe(true)
    expect(isCardClosed('CLOSED')).toBe(true)
    expect(isCardClosed('active')).toBe(false)
  })
})
