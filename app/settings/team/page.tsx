"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Users, Plus, Trash2, UserPlus, Shield, Eye, Crown } from "lucide-react"
import type { Team, TeamMember, TeamRole } from "@/types/team"

export default function TeamPage() {
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)

  // Form state
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [inviteAddress, setInviteAddress] = useState("")
  const [inviteRole, setInviteRole] = useState<TeamRole>("viewer")

  useEffect(() => {
    if (address) {
      loadTeams()
    }
  }, [address])

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id)
    }
  }, [selectedTeam])

  const loadTeams = async () => {
    if (!address) return
    setLoading(true)
    try {
      const response = await fetch("/api/teams", {
        headers: authHeaders(address),
      })
      const data = await response.json()
      if (response.ok) {
        setTeams(data.teams || [])
        if (data.teams?.length > 0 && !selectedTeam) {
          setSelectedTeam(data.teams[0])
        }
      }
    } catch (error) {
      console.error("Failed to load teams:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async (teamId: string) => {
    if (!address) return
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        headers: authHeaders(address),
      })
      const data = await response.json()
      if (response.ok) {
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Failed to load team members:", error)
    }
  }

  const handleCreateTeam = async () => {
    if (!address || !teamName) return

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: teamName,
          description: teamDescription,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setTeams((prev) => [data.team, ...prev])
        setSelectedTeam(data.team)
        toast({ title: "Team Created", description: `${teamName} has been created successfully` })
        setCreateDialogOpen(false)
        setTeamName("")
        setTeamDescription("")
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create team", variant: "destructive" })
    }
  }

  const handleInviteMember = async () => {
    if (!address || !selectedTeam || !inviteAddress) return

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          member_address: inviteAddress,
          role: inviteRole,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setMembers((prev) => [...prev, data.member])
        toast({ title: "Invitation Sent", description: `Invited ${inviteAddress.slice(0, 10)}...` })
        setInviteDialogOpen(false)
        setInviteAddress("")
        setInviteRole("viewer")
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to invite member", variant: "destructive" })
    }
  }

  const handleRemoveMember = async () => {
    if (!address || !selectedTeam || !memberToRemove) return

    try {
      const response = await fetch(
        `/api/teams/${selectedTeam.id}/members?member_address=${memberToRemove.member_address}`,
        {
          method: "DELETE",
          headers: authHeaders(address),
        }
      )

      if (response.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id))
        toast({ title: "Member Removed" })
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" })
    } finally {
      setDeleteDialogOpen(false)
      setMemberToRemove(null)
    }
  }

  const handleChangeRole = async (member: TeamMember, newRole: TeamRole) => {
    if (!address || !selectedTeam) return

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: "PATCH",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "change_role",
          member_address: member.member_address,
          role: newRole,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
        )
        toast({ title: "Role Updated" })
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to change role", variant: "destructive" })
    }
  }

  const isOwner = selectedTeam?.owner_address?.toLowerCase() === address?.toLowerCase()

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage teams
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">Manage your teams and collaborate with others</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a team to collaborate with others on payments and vendors
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Team Name</Label>
                <Input
                  placeholder="My Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="A description of your team..."
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={!teamName}>
                Create Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Your Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : teams.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No teams yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedTeam?.id === team.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedTeam(team)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{team.name}</span>
                      {team.owner_address?.toLowerCase() === address?.toLowerCase() && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {team.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {team.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {selectedTeam?.name || "Select a Team"}
                </CardTitle>
                {selectedTeam && (
                  <CardDescription>{selectedTeam.description || "No description"}</CardDescription>
                )}
              </div>
              {selectedTeam && isOwner && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Invite someone to join your team by their wallet address
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Wallet Address</Label>
                        <Input
                          placeholder="0x..."
                          value={inviteAddress}
                          onChange={(e) => setInviteAddress(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Viewer - Can only view data
                              </div>
                            </SelectItem>
                            <SelectItem value="owner">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Owner - Full access
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleInviteMember} disabled={!inviteAddress}>
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTeam ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a team to view members
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No members yet. Invite someone to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Owner row */}
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      {selectedTeam.owner_address?.slice(0, 10)}...
                      {selectedTeam.owner_address?.slice(-8)}
                      {selectedTeam.owner_address?.toLowerCase() === address?.toLowerCase() && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        <Crown className="h-3 w-3 mr-1" />
                        Owner
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  {/* Members */}
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm">
                        {member.member_address.slice(0, 10)}...{member.member_address.slice(-8)}
                        {member.member_address.toLowerCase() === address?.toLowerCase() && (
                          <Badge variant="outline" className="ml-2">You</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleChangeRole(member, v as TeamRole)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                            {member.role === "owner" ? (
                              <Shield className="h-3 w-3 mr-1" />
                            ) : (
                              <Eye className="h-3 w-3 mr-1" />
                            )}
                            {member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === "active"
                              ? "default"
                              : member.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setMemberToRemove(member)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the team? They will lose access to all
              team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
