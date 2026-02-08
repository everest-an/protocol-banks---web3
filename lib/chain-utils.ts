
export const ETHERSCAN_API_KEY = "DRBERJ8M8CMCNYFDAIMGJ2AYVVW4WIK3Z6";

export const CHAINS: Record<string, { name: string; explorer: string; id: number | string; symbol: string; apiUrl?: string; isTestnet?: boolean }> = {
  "1": { name: "Ethereum", explorer: "https://etherscan.io", id: 1, symbol: "ETH", apiUrl: "https://api.etherscan.io/api" },
  "ethereum": { name: "Ethereum", explorer: "https://etherscan.io", id: 1, symbol: "ETH", apiUrl: "https://api.etherscan.io/api" },
  "11155111": { name: "Sepolia", explorer: "https://sepolia.etherscan.io", id: 11155111, symbol: "ETH", apiUrl: "https://api-sepolia.etherscan.io/api", isTestnet: true },
  "sepolia": { name: "Sepolia (Test)", explorer: "https://sepolia.etherscan.io", id: 11155111, symbol: "ETH", apiUrl: "https://api-sepolia.etherscan.io/api", isTestnet: true },
  "137": { name: "Polygon", explorer: "https://polygonscan.com", id: 137, symbol: "MATIC" },
  "polygon": { name: "Polygon", explorer: "https://polygonscan.com", id: 137, symbol: "MATIC" },
  "80001": { name: "Mumbai (Test)", explorer: "https://mumbai.polygonscan.com", id: 80001, symbol: "MATIC", isTestnet: true },
  "56": { name: "BSC", explorer: "https://bscscan.com", id: 56, symbol: "BNB" },
  "bsc": { name: "BSC", explorer: "https://bscscan.com", id: 56, symbol: "BNB" },
  "42161": { name: "Arbitrum One", explorer: "https://arbiscan.io", id: 42161, symbol: "ETH" },
  "arbitrum": { name: "Arbitrum One", explorer: "https://arbiscan.io", id: 42161, symbol: "ETH" },
  "10": { name: "Optimism", explorer: "https://optimistic.etherscan.io", id: 10, symbol: "ETH" },
  "optimism": { name: "Optimism", explorer: "https://optimistic.etherscan.io", id: 10, symbol: "ETH" },
  "8453": { name: "Base", explorer: "https://basescan.org", id: 8453, symbol: "ETH" },
  "base": { name: "Base", explorer: "https://basescan.org", id: 8453, symbol: "ETH" },
  // TRON Networks
  "tron": { name: "TRON", explorer: "https://tronscan.org", id: "tron", symbol: "TRX" },
  "tron-mainnet": { name: "TRON", explorer: "https://tronscan.org", id: "tron", symbol: "TRX" },
  "tron-nile": { name: "TRON Nile (Test)", explorer: "https://nile.tronscan.org", id: "tron-nile", symbol: "TRX", isTestnet: true },
  "TRON": { name: "TRON", explorer: "https://tronscan.org", id: "tron", symbol: "TRX" },
  "TRON_NILE": { name: "TRON Nile (Test)", explorer: "https://nile.tronscan.org", id: "tron-nile", symbol: "TRX", isTestnet: true },
};

export function getExplorerLink(chain: string | number, hash: string, type: 'tx' | 'address' = 'tx'): string {
  const chainKey = String(chain).toLowerCase();
  const chainData = CHAINS[chainKey];
  
  if (chainData) {
      return `${chainData.explorer}/${type}/${hash}`;
  }

  // Fallback for unknown chains: Try general search or just return '#' if we really don't know
  // Better fallback: If it looks like an EVM address/hash, default to Etherscan but maybe warn?
  // User asked "How it displays for new chains".
  // If we return a google search link, it's actually quite helpful.
  return `https://google.com/search?q=${chain}+explorer+${hash}`;
}

export function getChainName(chain: string | number): string {
  const chainKey = String(chain).toLowerCase();
  return CHAINS[chainKey]?.name || String(chain);
}

export async function checkTransactionStatus(chain: string | number, txHash: string) {
  const chainKey = String(chain).toLowerCase();
  const chainData = CHAINS[chainKey];
  
  if (!chainData?.apiUrl) {
      console.warn(`No API URL for chain ${chain}`);
      return null;
  }

  // Note: This API Key is primarily for Ethereum Mainnet/Testnets. 
  // Other Etherscan-clones (PolygonScan, BscScan) usually require their own keys.
  const url = `${chainData.apiUrl}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  
  try {
      const response = await fetch(url);
      const data = await response.json();
      return data;
  } catch (error) {
      console.error("Error checking tx status:", error);
      return null;
  }
}
