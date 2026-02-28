import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/lib/services/team-service';
import { withAuth } from '@/lib/middleware/api-auth';

/**
 * GET /api/teams
 * List all teams for the current user
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const teams = await teamService.listTeams(userAddress);

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('[API] Failed to list teams:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list teams' },
      { status: 500 }
    );
  }
}, { component: 'teams' })

/**
 * POST /api/teams
 * Create a new team
 */
export const POST = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    const team = await teamService.createTeam(userAddress, {
      name,
      description,
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create team:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create team' },
      { status: 500 }
    );
  }
}, { component: 'teams' })
