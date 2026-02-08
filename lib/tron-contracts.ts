// Tron contract addresses for mainnet and Nile testnet

export const TRON_CONTRACTS = {
  mainnet: {
    paymentVault: process.env.NEXT_PUBLIC_TRON_PAYMENT_VAULT_MAINNET || "",
    paymentSplitter: process.env.NEXT_PUBLIC_TRON_PAYMENT_SPLITTER_MAINNET || "",
    yieldAggregator: process.env.NEXT_PUBLIC_TRON_YIELD_AGGREGATOR_MAINNET || "",
  },
  nile: {
    paymentVault: process.env.NEXT_PUBLIC_TRON_PAYMENT_VAULT_NILE || "TSrRLNoyJ9mVNZMg6jA8hUzABxHA1ZBFGM",
    paymentSplitter: process.env.NEXT_PUBLIC_TRON_PAYMENT_SPLITTER_NILE || "TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z",
    yieldAggregator: process.env.NEXT_PUBLIC_TRON_YIELD_AGGREGATOR_NILE || "TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy",
  },
}

export const TRONSCAN_URLS = {
  mainnet: "https://tronscan.org/#/contract/",
  nile: "https://nile.tronscan.org/#/contract/",
}
