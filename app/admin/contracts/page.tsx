"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileCode, Plus, ExternalLink, CheckCircle, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"

export const dynamic = "force-dynamic"

interface ContractDeployment {
  id: string
  contract_name: string
  contract_type: string
  chain_id: number
  chain_name: string
  address: string
  is_verified: boolean
  is_active: boolean
  version: string
  created_at: string
}

const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum Mainnet", explorer: "https://etherscan.io" },
  { id: 137, name: "Polygon", explorer: "https://polygonscan.com" },
  { id: 8453, name: "Base", explorer: "https://basescan.org" },
  { id: 42161, name: "Arbitrum One", explorer: "https://arbiscan.io" },
  { id: 10, name: "Optimism", explorer: "https://optimistic.etherscan.io" },
  { id: 7000, name: "ZetaChain Mainnet", explorer: "https://explorer.zetachain.com" },
  { id: 7001, name: "ZetaChain Testnet", explorer: "https://athens.explorer.zetachain.com" },
]

const CONTRACT_TYPES = [
  { value: "payment", label: "Payment Contract" },
  { value: "swap", label: "Swap Router" },
  { value: "cctp", label: "CCTP Bridge" },
  { value: "zetachain", label: "ZetaChain Universal" },
  { value: "treasury", label: "Treasury" },
]

export default function ContractsPage() {
  const { address, isConnected } = useUnifiedWallet()
  const [contracts, setContracts] = useState<ContractDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [contractName, setContractName] = useState("")
  const [contractType, setContractType] = useState("")
  const [chainId, setChainId] = useState("")
  const [contractAddress, setContractAddress] = useState("")

  const getContractsStorageKey = () => `pb:admin:contracts:${(address || "global").toLowerCase()}`

  useEffect(() => {
    fetchContracts()
  }, [])

  async function fetchContracts() {
    setLoading(true)
    try {
      const stored = localStorage.getItem(getContractsStorageKey()) || localStorage.getItem("admin_contract_deployments")
      if (stored) {
        setContracts(JSON.parse(stored))
      }
    } catch (e) {
      console.error("Failed to load contracts:", e)
    }
    setLoading(false)
  }

  async function addContract() {
    if (!contractName || !contractType || !chainId || !contractAddress) {
      toast.error("Please fill all fields")
      return
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress.trim())) {
      toast.error("Invalid contract address format")
      return
    }

    setSaving(true)

    const chain = SUPPORTED_CHAINS.find((c) => c.id === Number(chainId))

    const newContract: ContractDeployment = {
      id: crypto.randomUUID(),
      contract_name: contractName,
      contract_type: contractType,
      chain_id: Number(chainId),
      chain_name: chain?.name || "Unknown",
      address: contractAddress.trim(),
      is_verified: false,
      is_active: true,
      version: "1.0.0",
      created_at: new Date().toISOString(),
    }

    const updated = [...contracts, newContract]
    setContracts(updated)
    localStorage.setItem(getContractsStorageKey(), JSON.stringify(updated))

    toast.success("Contract added successfully")
    setDialogOpen(false)
    setContractName("")
    setContractType("")
    setChainId("")
    setContractAddress("")
    setSaving(false)
  }

  async function toggleContractStatus(id: string, currentStatus: boolean) {
    const updated = contracts.map((c) =>
      c.id === id ? { ...c, is_active: !currentStatus } : c,
    )
    setContracts(updated)
    localStorage.setItem(getContractsStorageKey(), JSON.stringify(updated))
    toast.success(`Contract ${!currentStatus ? "activated" : "deactivated"}`)
  }

  function getExplorerUrl(chainId: number, address: string) {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
    return chain ? `${chain.explorer}/address/${address}` : "#"
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address)
    toast.success("Address copied")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Contract Deployments</h1>
          <p className="text-muted-foreground mt-2">Manage smart contract addresses for each network</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contract Deployment</DialogTitle>
              <DialogDescription>Register a new smart contract address</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Contract Name</Label>
                <Input
                  placeholder="e.g., PaymentRouter"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Contract Type</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Network</Label>
                <Select value={chainId} onValueChange={setChainId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={String(chain.id)}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contract Address</Label>
                <Input
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                />
              </div>
              <Button onClick={addContract} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Contract
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployed Contracts</CardTitle>
          <CardDescription>Smart contracts deployed across supported networks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contracts.length === 0 ? (
            <Alert>
              <FileCode className="h-4 w-4" />
              <AlertDescription>No contracts registered yet. Add your first contract deployment.</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      {contract.contract_name}
                      <span className="text-xs text-muted-foreground ml-2">v{contract.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contract.contract_type}</Badge>
                    </TableCell>
                    <TableCell>{contract.chain_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyAddress(contract.address)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {contract.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {contract.is_verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={getExplorerUrl(contract.chain_id, contract.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleContractStatus(contract.id, contract.is_active)}
                        >
                          {contract.is_active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
