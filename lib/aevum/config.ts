export const AEVUM = {
  chainId: 44005,
  chainIdHex: "0xABE5",
  name: "QDay Aevum",
  rpcUrl: "https://rpc-test.qday.info",
  explorer: "https://explorer-test.qday.info",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  token: {
    address: "0x456569838f1d43009A91ebA4263147Afd7233483",
    symbol: "tUSD8",
    decimals: 6,
  },
} as const

export function explorerTx(hash: string): string {
  return `${AEVUM.explorer}/tx/${hash}`
}

export function explorerAddress(address: string): string {
  return `${AEVUM.explorer}/address/${address}`
}
