"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { multisigService, type MultisigWallet, type MultisigTransaction } from "@/lib/multisig"
import { Shield, Plus, Users, ArrowRight, Trash2 } from "lucide-react"

const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 137, name: "Polygon" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
]

export default function MultisigPage() {
  const { address, signMessage } = useWeb3()
  const { toast } = useToast()
  const [wallets, setWallets] = useState<MultisigWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<MultisigWallet | null>(null)
  const [pendingTxs, setPendingTxs] = useState<MultisigTransaction[]>([])

  // Create form state
  const [walletName, setWalletName] = useState("")
  const [signers, setSigners] = useState<string[]>([""])
  const [threshold, setThreshold] = useState(2)
  const [chainId, setChainId] = useState(1)

  useEffect(() => {
    if (address) {
      loadWallets()
    }
  }, [address])

  useEffect(() => {
    if (selectedWallet) {
      loadPendingTransactions(selectedWallet.id)
    }
  }, [selectedWallet])

  const loadWallets = async () => {
    if (!address) return
    setLoading(true)
    try {
      const data = await multisigService.getWallets(address)
      setWallets(data)
      if (data.length > 0 && !selectedWallet) {
        setSelectedWallet(data[0])
      }
    } catch (error) {
      console.error("Failed to load wallets:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingTransactions = async (walletId: string) => {
    try {
      const txs = await multisigService.getPendingTransactions(walletId)
      setPendingTxs(txs)
    } catch (error) {
      console.error("Failed to load transactions:", error)
    }
  }

  const handleAddSigner = () => {
    setSigners([...signers, ""])
  }

  const handleRemoveSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index))
  }

  const handleSignerChange = (index: number, value: string) => {
    const newSigners = [...signers]
    newSigners[index] = value
    setSigners(newSigners)
  }

  const handleCreateWallet = async () => {
    if (!address) return

    const validSigners = signers.filter((s) => s.trim() !== "")
    if (validSigners.length < 2) {
      toast({
        title: "Error",
        description: "At least 2 signers are required",
        variant: "destructive",
      })
      return
    }

    if (threshold > validSigners.length) {
      toast({
        title: "Error",
        description: "Threshold cannot exceed number of signers",
        variant: "destructive",
      })
      return
    }

    try {
      const wallet = await multisigService.createWallet({
        name: walletName,
        signers: validSigners,
        threshold,
        chainId,
        createdBy: address,
      })

      setWallets((prev) => [wallet, ...prev])
      setSelectedWallet(wallet)
      setCreateDialogOpen(false)
      setWalletName("")
      setSigners([""])
      setThreshold(2)

      toast({
        title: "Multi-sig Wallet Created",
        description: `${wallet.name} has been created successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create wallet",
        variant: "destructive",
      })
    }
  }

  const handleSignTransaction = async (tx: MultisigTransaction) => {
    if (!address || !signMessage) return

    try {
      // Create message to sign
      const message = JSON.stringify({
        to: tx.to_address,
        value: tx.value,
        data: tx.data,
        nonce: tx.safe_nonce,
      })

      const signature = await signMessage(message)

      await multisigService.confirmTransaction({
        transactionId: tx.id,
        signerAddress: address,
        signature,
      })

      toast({ title: "Transaction Signed" })
      loadPendingTransactions(tx.multisig_id)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign transaction",
        variant: "destructive",
      })
    }
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage multi-signature wallets
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Multi-Signature Wallets</h1>
          <p className="text-muted-foreground">Require multiple approvals for transactions</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Multi-sig
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Multi-Signature Wallet</DialogTitle>
              <DialogDescription>
                Set up a wallet that requires multiple signatures to authorize transactions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Wallet Name</Label>
                <Input
                  placeholder="Company Treasury"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                />
              </div>

              <div>
                <Label>Network</Label>
                <Select value={chainId.toString()} onValueChange={(v) => setChainId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id.toString()}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Signers</Label>
                  <Button variant="outline" size="sm" onClick={handleAddSigner}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Signer
                  </Button>
                </div>
                <div className="space-y-2">
                  {signers.map((signer, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="0x..."
                        value={signer}
                        onChange={(e) => handleSignerChange(index, e.target.value)}
                        className="font-mono text-sm"
                      />
                      {signers.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveSigner(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Threshold (signatures required)</Label>
                <Select value={threshold.toString()} onValueChange={(v) => setThreshold(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {signers
                      .filter((s) => s.trim())
                      .map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} of {signers.filter((s) => s.trim()).length}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWallet} disabled={!walletName || signers.filter((s) => s.trim()).length < 2}>
                Create Wallet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Wallet List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : wallets.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No multi-sig wallets yet</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedWallet?.id === wallet.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedWallet(wallet)}
                  >
                    <div className="font-medium">{wallet.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Users className="h-3 w-3" />
                      {wallet.threshold} of {wallet.signers?.length || 0}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">
                      {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedWallet ? selectedWallet.name : "Select a Wallet"}</CardTitle>
            {selectedWallet && <CardDescription className="font-mono">{selectedWallet.wallet_address}</CardDescription>}
          </CardHeader>
          <CardContent>
            {selectedWallet ? (
              <Tabs defaultValue="transactions">
                <TabsList className="mb-4">
                  <TabsTrigger value="transactions">Pending Transactions</TabsTrigger>
                  <TabsTrigger value="signers">Signers</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions">
                  {pendingTxs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No pending transactions</div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTxs.map((tx) => {
                        const confirmationCount = tx.confirmations?.length || 0
                        const threshold = selectedWallet.threshold
                        const progress = (confirmationCount / threshold) * 100

                        return (
                          <div key={tx.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium">{tx.description || "Transfer"}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                  <ArrowRight className="h-3 w-3" />
                                  {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-8)}
                                </div>
                                {tx.amount_usd && (
                                  <div className="text-lg font-semibold mt-2">
                                    ${tx.amount_usd.toLocaleString()} {tx.token_symbol}
                                  </div>
                                )}
                              </div>
                              <Badge
                                variant={
                                  tx.status === "confirmed"
                                    ? "default"
                                    : tx.status === "executed"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {tx.status}
                              </Badge>
                            </div>

                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Confirmations</span>
                                <span>
                                  {confirmationCount} / {threshold}
                                </span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>

                            <div className="mt-4 flex gap-2">
                              {tx.status === "pending" && (
                                <Button size="sm" onClick={() => handleSignTransaction(tx)}>
                                  Sign Transaction
                                </Button>
                              )}
                              {tx.status === "confirmed" && (
                                <Button size="sm" variant="default">
                                  Execute
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="signers">
                  <div className="space-y-2">
                    {selectedWallet.signers?.map((signer) => (
                      <div key={signer.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{signer.signer_name || "Signer"}</div>
                          <div className="text-sm font-mono text-muted-foreground">{signer.signer_address}</div>
                        </div>
                        <Badge variant={signer.is_active ? "default" : "secondary"}>
                          {signer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Select a wallet to view details</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
