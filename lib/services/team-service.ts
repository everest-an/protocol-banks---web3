/**
 * Team Service
 * Manages teams and team member permissions (Owner/Viewer)
 */

import { prisma } from '@/lib/prisma';
import type {
  Team,
  TeamMember,
  TeamRole,
  MemberStatus,
  CreateTeamInput,
  UpdateTeamInput,
  InviteMemberInput,
  TeamWithMembers,
  TeamPermission,
  TeamAuditLog,
  TeamAuditAction,
} from '@/types';

// ============================================
// Team Service Class
// ============================================

export class TeamService {
  constructor() {}

  // ============================================
  // Alias Methods for API Compatibility
  // ============================================

  /**
   * Alias for listTeamsForUser - used by API routes
   */
  listTeams = (userAddress: string) => this.listTeamsForUser(userAddress);

  /**
   * Alias for getTeamWithMembers - used by API routes
   * Returns just the members array for compatibility
   */
  async getTeamMembers(teamId: string) {
    const teamWithMembers = await this.getTeamWithMembers(teamId);
    return teamWithMembers?.members || [];
  }

  // ============================================
  // Team CRUD Operations
  // ============================================

  /**
   * Create a new team
   */
  async createTeam(
    ownerAddress: string,
    input: CreateTeamInput
  ): Promise<Team> {
    
    const result = await prisma.$transaction(async (tx) => {
        // Create team
        const team = await tx.team.create({
            data: {
                name: input.name,
                description: input.description,
                owner_address: ownerAddress,
            }
        });

        // Add owner as member
        await tx.teamMember.create({
            data: {
                team_id: team.id,
                member_address: ownerAddress,
                role: 'owner',
                status: 'active',
                invited_by: ownerAddress,
                accepted_at: new Date(),
            }
        });

        // Log action (will handle this separately or inline if logAction logic is simple)
        // Reusing logAction helper logic here manually because it's private and async
        await tx.teamAuditLog.create({
            data: {
                team_id: team.id,
                user_address: ownerAddress,
                action: 'team_created',
                details: { name: input.name },
            }
        });

        return team;
    });

    return {
        ...result,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString()
    };
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string): Promise<Team | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) return null;

    return {
        ...team,
        created_at: team.created_at.toISOString(),
        updated_at: team.updated_at.toISOString()
    };
  }

  /**
   * Get team with members
   */
  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) return null;

    const members = await prisma.teamMember.findMany({
      where: {
        team_id: teamId,
        status: { not: 'removed' }
      },
      orderBy: { invited_at: 'asc' }
    });

    const mappedMembers: TeamMember[] = members.map(m => ({
        ...m,
        invited_at: m.invited_at.toISOString(),
        accepted_at: m.accepted_at ? m.accepted_at.toISOString() : undefined,
        status: m.status as MemberStatus
    }));

    return {
      ...team,
      created_at: team.created_at.toISOString(),
      updated_at: team.updated_at.toISOString(),
      members: mappedMembers,
    };
  }

  /**
   * Update team
   */
  async updateTeam(
    teamId: string,
    userAddress: string,
    input: UpdateTeamInput
  ): Promise<Team> {
    // Check permission
    const isOwner = await this.isTeamOwner(teamId, userAddress);
    if (!isOwner) {
      throw new Error('Only team owners can update team settings');
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...input,
        updated_at: new Date(),
      }
    });

    await this.logAction(teamId, userAddress, 'team_updated', input as Record<string, unknown>);

    return {
        ...team,
        created_at: team.created_at.toISOString(),
        updated_at: team.updated_at.toISOString()
    };
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId: string, userAddress: string): Promise<void> {
    // Only the original owner can delete
    const team = await this.getTeam(teamId);
    if (!team || team.owner_address !== userAddress) {
      throw new Error('Only the team owner can delete the team');
    }

    await prisma.team.delete({
      where: { id: teamId }
    });
  }

  /**
   * List teams for a user
   */
  async listTeamsForUser(userAddress: string): Promise<Team[]> {
    // Get teams where user is owner
    const ownedTeams = await prisma.team.findMany({
      where: { owner_address: userAddress }
    });

    // Get teams where user is a member
    const memberTeams = await prisma.teamMember.findMany({
      where: {
        member_address: userAddress,
        status: 'active'
      },
      include: {
        team: true
      }
    });

    const memberTeamData = memberTeams.map(mt => mt.team);

    // Merge and deduplicate
    const allTeams = [...ownedTeams, ...memberTeamData];
    const uniqueTeams = allTeams.filter(
      (team, index, self) => index === self.findIndex((t) => t.id === team.id)
    );

    return uniqueTeams.map(t => ({
        ...t,
        created_at: t.created_at.toISOString(),
        updated_at: t.updated_at.toISOString()
    }));
  }

  // ============================================
  // Member Management
  // ============================================

  /**
   * Invite a member to the team
   */
  async inviteMember(
    teamId: string,
    inviterAddress: string,
    input: InviteMemberInput
  ): Promise<TeamMember> {
    // Check if inviter is an owner
    const isOwner = await this.isTeamOwner(teamId, inviterAddress);
    if (!isOwner) {
      throw new Error('Only team owners can invite members');
    }

    // Check if member already exists
    const existing = await prisma.teamMember.findUnique({
      where: {
        team_id_member_address: {
            team_id: teamId,
            member_address: input.member_address
        }
      }
    });

    if (existing && existing.status !== 'removed') {
      throw new Error('Member already exists in the team');
    }

    // Create or update member
    const member = await prisma.teamMember.upsert({
      where: {
        team_id_member_address: {
            team_id: teamId,
            member_address: input.member_address
        }
      },
      update: {
        role: input.role,
        status: 'pending',
        invited_by: inviterAddress,
        invited_at: new Date(),
      },
      create: {
        team_id: teamId,
        member_address: input.member_address,
        role: input.role,
        status: 'pending',
        invited_by: inviterAddress,
        invited_at: new Date(),
      }
    });

    await this.logAction(teamId, inviterAddress, 'member_invited', {
      member_address: input.member_address,
      role: input.role,
    });

    return {
        ...member,
        invited_at: member.invited_at.toISOString(),
        accepted_at: member.accepted_at?.toISOString(),
        status: member.status as MemberStatus
    };
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(teamId: string, memberAddress: string): Promise<TeamMember> {
    
    // Check pending status first to ensure we are updating a pending invite
    const existing = await prisma.teamMember.findFirst({
        where: {
            team_id: teamId,
            member_address: memberAddress,
            status: 'pending'
        }
    });

    if (!existing) {
        throw new Error('No pending invitation found');
    }

    const member = await prisma.teamMember.update({
      where: {
        id: existing.id
      },
      data: {
        status: 'active',
        accepted_at: new Date(),
      }
    });

    await this.logAction(teamId, memberAddress, 'member_accepted', {});

    return {
        ...member,
        invited_at: member.invited_at.toISOString(),
        accepted_at: member.accepted_at?.toISOString(),
        status: member.status as MemberStatus
    };
  }

  /**
   * Remove a member from the team
   */
  async removeMember(
    teamId: string,
    removerAddress: string,
    memberAddress: string
  ): Promise<void> {
    // Check if remover is an owner
    const isOwner = await this.isTeamOwner(teamId, removerAddress);
    if (!isOwner) {
      throw new Error('Only team owners can remove members');
    }

    // Cannot remove the original team owner
    const team = await this.getTeam(teamId);
    if (team?.owner_address === memberAddress) {
      throw new Error('Cannot remove the original team owner');
    }

    await prisma.teamMember.updateMany({
      where: {
        team_id: teamId,
        member_address: memberAddress
      },
      data: { status: 'removed' }
    });

    await this.logAction(teamId, removerAddress, 'member_removed', {
      member_address: memberAddress,
    });
  }

  /**
   * Change member role
   */
  async changeRole(
    teamId: string,
    changerAddress: string,
    memberAddress: string,
    newRole: TeamRole
  ): Promise<TeamMember> {
    // Check if changer is an owner
    const isOwner = await this.isTeamOwner(teamId, changerAddress);
    if (!isOwner) {
      throw new Error('Only team owners can change member roles');
    }

    // Cannot change original owner's role
    const team = await this.getTeam(teamId);
    if (team?.owner_address === memberAddress && newRole !== 'owner') {
      throw new Error('Cannot demote the original team owner');
    }

    // Use updateMany trick or find first then update
    // Prefer find first + update as updateMany doesn't return data
    const memberRecord = await prisma.teamMember.findFirst({
        where: {
            team_id: teamId,
            member_address: memberAddress
        }
    });

    if (!memberRecord) {
        throw new Error('Member not found');
    }

    const member = await prisma.teamMember.update({
      where: { id: memberRecord.id },
      data: { role: newRole }
    });

    await this.logAction(teamId, changerAddress, 'role_changed', {
      member_address: memberAddress,
      new_role: newRole,
    });

    return {
        ...member,
        invited_at: member.invited_at.toISOString(),
        accepted_at: member.accepted_at?.toISOString(),
        status: member.status as MemberStatus
    };
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userAddress: string): Promise<(TeamMember & { team: Team })[]> {
    const invitations = await prisma.teamMember.findMany({
      where: {
        member_address: userAddress,
        status: 'pending'
      },
      include: {
        team: true
      }
    });

    return invitations.map(inv => ({
        ...inv,
        invited_at: inv.invited_at.toISOString(),
        accepted_at: inv.accepted_at?.toISOString(),
        status: inv.status as MemberStatus,
        team: {
            ...inv.team,
            created_at: inv.team.created_at.toISOString(),
            updated_at: inv.team.updated_at.toISOString()
        }
    }));
  }

  // ============================================
  // Permission Checks
  // ============================================

  /**
   * Check if user is a team owner
   */
  async isTeamOwner(teamId: string, userAddress: string): Promise<boolean> {
    // Check if user is the original owner
    const team = await this.getTeam(teamId);
    if (team?.owner_address === userAddress) return true;

    // Check if user has owner role
    const member = await prisma.teamMember.findFirst({
        where: {
            team_id: teamId,
            member_address: userAddress,
            status: 'active',
            role: 'owner'
        }
    });

    return !!member;
  }

  /**
   * Check if user is a team member
   */
  async isTeamMember(teamId: string, userAddress: string): Promise<boolean> {
    const member = await prisma.teamMember.findFirst({
        where: {
            team_id: teamId,
            member_address: userAddress,
            status: 'active'
        }
    });

    return !!member;
  }

  /**
   * Get user's permissions for a team
   */
  async getPermissions(teamId: string, userAddress: string): Promise<TeamPermission> {
    const member = await prisma.teamMember.findFirst({
        where: {
            team_id: teamId,
            member_address: userAddress,
            status: 'active'
        },
        select: { role: true }
    });

    if (!member) {
      return { can_read: false, can_write: false, role: null };
    }

    const role = member.role as TeamRole;
    return {
      can_read: true,
      can_write: role === 'owner',
      role,
    };
  }

  // ============================================
  // Audit Logging
  // ============================================

  /**
   * Log an action to the audit log
   */
  private async logAction(
    teamId: string,
    userAddress: string,
    action: TeamAuditAction,
    details: Record<string, unknown>
  ): Promise<void> {
    await prisma.teamAuditLog.create({
        data: {
      team_id: teamId,
      user_address: userAddress,
      action,
      details,
        }
    });
  }

  /**
   * Get audit logs for a team
   */
  async getAuditLogs(
    teamId: string,
    limit: number = 50
  ): Promise<TeamAuditLog[]> {
    const logs = await prisma.teamAuditLog.findMany({
      where: { team_id: teamId },
      orderBy: { created_at: 'desc' },
      take: limit
    });
    
    return logs.map(l => ({
        ...l,
        created_at: l.created_at.toISOString(),
        details: l.details || {}
    }));
  }
}

// Export singleton instance
export const teamService = new TeamService();
