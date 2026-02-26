import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/lib/services/team-service';
import type { TeamRole } from '@/types/team';
import { getAuthenticatedAddress } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teams/[id]/members
 * List team members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Check access
    const isMember = await teamService.isTeamMember(id, userAddress);
    const isOwner = await teamService.isTeamOwner(id, userAddress);

    if (!isMember && !isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const members = await teamService.getTeamMembers(id);

    return NextResponse.json({ members });
  } catch (error: any) {
    console.error('[API] Failed to get team members:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/[id]/members
 * Invite a member to the team
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Only owner can invite
    const isOwner = await teamService.isTeamOwner(id, userAddress);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only team owner can invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { member_address, role = 'viewer' } = body;

    if (!member_address) {
      return NextResponse.json(
        { error: 'Member address is required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['owner', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "owner" or "viewer"' },
        { status: 400 }
      );
    }

    const member = await teamService.inviteMember(id, userAddress, {
      member_address,
      role: role as TeamRole,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to invite member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invite member' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/teams/[id]/members
 * Accept invitation or change role
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, member_address, role } = body;

    if (action === 'accept') {
      // User accepting their own invitation
      const member = await teamService.acceptInvitation(id, userAddress);
      return NextResponse.json({ member });
    }

    if (action === 'change_role') {
      // Only owner can change roles
      const isOwner = await teamService.isTeamOwner(id, userAddress);
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only team owner can change roles' },
          { status: 403 }
        );
      }

      if (!member_address || !role) {
        return NextResponse.json(
          { error: 'member_address and role are required' },
          { status: 400 }
        );
      }

      const member = await teamService.changeRole(id, userAddress, member_address, role as TeamRole);
      return NextResponse.json({ member });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "accept" or "change_role"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Failed to update member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]/members
 * Remove a member from the team
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const memberAddress = searchParams.get('member_address');

    if (!memberAddress) {
      return NextResponse.json(
        { error: 'member_address query parameter is required' },
        { status: 400 }
      );
    }

    // Owner can remove anyone, members can only remove themselves
    const isOwner = await teamService.isTeamOwner(id, userAddress);
    const isSelf = memberAddress.toLowerCase() === userAddress.toLowerCase();

    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: 'You can only remove yourself or you must be the team owner' },
        { status: 403 }
      );
    }

    await teamService.removeMember(id, userAddress, memberAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Failed to remove member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove member' },
      { status: 500 }
    );
  }
}
