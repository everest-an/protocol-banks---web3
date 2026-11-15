import { budgetAlertLevel } from "@/lib/finance/budget-alerts"

describe("finance budget alerts", () => {
  it("does not alert below 80%", () => {
    expect(budgetAlertLevel(0, 100)).toBe(0)
    expect(budgetAlertLevel(79.99, 100)).toBe(0)
  })

  it("alerts at 80% and 100%", () => {
    expect(budgetAlertLevel(80, 100)).toBe(80)
    expect(budgetAlertLevel(99.99, 100)).toBe(80)
    expect(budgetAlertLevel(100, 100)).toBe(100)
    expect(budgetAlertLevel(150, 100)).toBe(100)
  })

  it("never alerts on an invalid budget", () => {
    expect(budgetAlertLevel(10, 0)).toBe(0)
    expect(budgetAlertLevel(10, -1)).toBe(0)
    expect(budgetAlertLevel(Number.NaN, 100)).toBe(0)
  })
})
