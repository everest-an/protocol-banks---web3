
export const ETHERSCAN_API_KEY = "DRBERJ8M8CMCNYFDAIMGJ2AYVVW4WIK3Z6";

export const CHAINS: Record<string, { name: string; explorer: string; id: number; symbol: string; apiUrl?: string }> = {
  "1": { name: "Ethereum", explorer: "https://etherscan.io", id: 1, symbol: "ETH", apiUrl: "https://api.etherscan.io/api" },
  "ethereum": { name: "Ethereum", explorer: "https://etherscan.io", id: 1, symbol: "ETH", apiUrl: "https://api.etherscan.io/api" },
  "11155111": { name: "Sepolia", explorer: "https://sepolia.etherscan.io", id: 11155111, symbol: "ETH", apiUrl: "https://api-sepolia.etherscan.io/api" },
  "sepolia": { name: "Sepolia", explorer: "https://sepolia.etherscan.io", id: 11155111, symbol: "ETH", apiUrl: "https://api-sepolia.etherscan.io/api" },
  "137": { name: "Polygon", explorer: "https://polygonscan.com", id: 137, symbol: "MATIC" },
  "polygon": { name: "Polygon", explorer: "https://polygonscan.com", id: 137, symbol: "MATIC" },
  "80001": { name: "Mumbai", explorer: "https://mumbai.polygonscan.com", id: 80001, symbol: "MATIC" },
  "56": { name: "BSC", explorer: "https://bscscan.com", id: 56, symbol: "BNB" },
  "bsc": { name: "BSC", explorer: "https://bscscan.com", id: 56, symbol: "BNB" },
  "42161": { name: "Arbitrum One", explorer: "https://arbiscan.io", id: 42161, symbol: "ETH" },
  "arbitrum": { name: "Arbitrum One", explorer: "https://arbiscan.io", id: 42161, symbol: "ETH" },
  "10": { name: "Optimism", explorer: "https://optimistic.etherscan.io", id: 10, symbol: "ETH" },
  "optimism": { name: "Optimism", explorer: "https://optimistic.etherscan.io", id: 10, symbol: "ETH" },
  "8453": { name: "Base", explorer: "https://basescan.org", id: 8453, symbol: "ETH" },
  "base": { name: "Base", explorer: "https://basescan.org", id: 8453, symbol: "ETH" },
};

export function getExplorerLink(chain: string | number, hash: string, type: 'tx' | 'address' = 'tx'): string {
  const chainKey = String(chain).toLowerCase();
  const chainData = CHAINS[chainKey] || CHAINS["ethereum"];
  return `${chainData.explorer}/${type}/${hash}`;
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
