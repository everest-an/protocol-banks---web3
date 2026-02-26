import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/lib/services/team-service';
import { getAuthenticatedAddress } from '@/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teams/[id]
 * Get team details
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

    const team = await teamService.getTeam(id);

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    const isMember = await teamService.isTeamMember(id, userAddress);
    const isOwner = await teamService.isTeamOwner(id, userAddress);

    if (!isMember && !isOwner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get team members
    const members = await teamService.getTeamMembers(id);

    return NextResponse.json({
      team,
      members,
      permissions: {
        isOwner,
        isMember,
        canEdit: isOwner,
        canInvite: isOwner,
      },
    });
  } catch (error: any) {
    console.error('[API] Failed to get team:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get team' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teams/[id]
 * Update team details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userAddress = await getAuthenticatedAddress(request);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 401 }
      );
    }

    // Only owner can update
    const isOwner = await teamService.isTeamOwner(id, userAddress);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only team owner can update team' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const team = await teamService.updateTeam(id, userAddress, { name, description });

    return NextResponse.json({ team });
  } catch (error: any) {
    console.error('[API] Failed to update team:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update team' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete team
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

    // Only owner can delete
    const isOwner = await teamService.isTeamOwner(id, userAddress);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only team owner can delete team' },
        { status: 403 }
      );
    }

    await teamService.deleteTeam(id, userAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Failed to delete team:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete team' },
      { status: 500 }
    );
  }
}
