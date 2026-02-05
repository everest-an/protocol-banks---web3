export const PAYMENT_PURPOSES = [
  { value: "salary", label: "Salary", color: "blue" },
  { value: "reimbursement", label: "Reimbursement", color: "green" },
  { value: "procurement", label: "Procurement", color: "orange" },
  { value: "service", label: "Service", color: "purple" },
  { value: "investment", label: "Investment", color: "indigo" },
  { value: "other", label: "Other", color: "gray" },
] as const

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number]["value"]

export const PURPOSE_COLORS: Record<string, string> = {
  salary: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  reimbursement: "bg-green-500/10 text-green-500 border-green-500/20",
  procurement: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  service: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  investment: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}
