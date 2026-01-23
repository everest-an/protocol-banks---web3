"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { FileText, Check, X, Clock, Bot } from "lucide-react"
import Link from "next/link"

interface Proposal {
  id: string
  agent_id: string
  agent_name: string
  recipient_address: string
  amount: string
  token_symbol: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
  created_at: string
  expires_at?: string
}

export default function ProposalsPage() {
  const { wallets } = useWeb3()
  const address = wallets.EVM
  const { toast } = useToast()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    if (address) {
      loadProposals()
    }
  }, [address, filter])

  const loadProposals = async () => {
    if (!address) return
    setLoading(true)
    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`
      const response = await fetch(`/api/agents/proposals?owner=${address}${statusParam}`)
      if (response.ok) {
        const data = await response.json()
        setProposals(data.proposals || [])
      }
    } catch (error) {
      console.error("Failed to load proposals:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/agents/proposals/${proposalId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_address: address }),
      })

      if (response.ok) {
        toast({ title: "Proposal Approved", description: "Payment will be executed" })
        loadProposals()
      } else {
        throw new Error('Failed to approve proposal')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve proposal",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/agents/proposals/${proposalId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_address: address }),
      })

      if (response.ok) {
        toast({ title: "Proposal Rejected" })
        loadProposals()
      } else {
        throw new Error('Failed to reject proposal')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject proposal",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: Proposal['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      executed: 'default',
      expired: 'outline',
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to view proposals
          </CardContent>
        </Card>
      </div>
    )
  }

  const pendingCount = proposals.filter(p => p.status === 'pending').length

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Payment Proposals
          </h1>
          <p className="text-muted-foreground">Review and approve payment requests from your AI agents</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved">
            <Check className="h-4 w-4 mr-2" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <X className="h-4 w-4 mr-2" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No {filter === 'all' ? '' : filter} proposals
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>
                        <Link href={`/agents/${proposal.agent_id}`} className="flex items-center gap-2 hover:underline">
                          <Bot className="h-4 w-4" />
                          {proposal.agent_name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {proposal.recipient_address.slice(0, 6)}...{proposal.recipient_address.slice(-4)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {proposal.amount} {proposal.token_symbol}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {proposal.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(proposal.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {proposal.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(proposal.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(proposal.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
