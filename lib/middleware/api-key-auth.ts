/**
 * API Key Authentication Middleware
 * Validates API keys and attaches owner information to request context
 */

import { type NextRequest, NextResponse } from 'next/server';
import { APIKeyService, type APIKey, type Permission } from '@/lib/services/api-key-service';

// ============================================
// Types
// ============================================

export interface AuthenticatedRequest extends NextRequest {
  apiKey?: APIKey;
  ownerAddress?: string;
  authMethod?: 'api_key' | 'session';
}

export interface AuthResult {
  authenticated: boolean;
  apiKey?: APIKey;
  ownerAddress?: string;
  authMethod?: 'api_key' | 'session';
  error?: string;
  statusCode?: number;
}

export interface MiddlewareOptions {
  requiredPermissions?: Permission[];
  allowSession?: boolean; // Allow session-based auth as fallback
}

// ============================================
// Constants
// ============================================

const API_KEY_HEADER = 'authorization';
const API_KEY_PREFIX = 'Bearer ';

// ============================================
// Helper Functions
// ============================================

/**
 * Extract API key from Authorization header
 */
export function extractAPIKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get(API_KEY_HEADER);
  
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const token = authHeader.slice(API_KEY_PREFIX.length).trim();
  
  // Check if it's an API key (starts with pb_)
  if (!token.startsWith('pb_')) {
    return null;
  }

  return token;
}

/**
 * Validate API key and return authentication result
 */
export async function validateAPIKey(apiKeySecret: string): Promise<AuthResult> {
  const apiKeyService = new APIKeyService();
  
  const result = await apiKeyService.validate(apiKeySecret);
  
  if (!result.valid || !result.key) {
    return {
      authenticated: false,
      error: result.error || 'Invalid API key',
      statusCode: 401,
    };
  }

  return {
    authenticated: true,
    apiKey: result.key,
    ownerAddress: result.key.owner_address,
    authMethod: 'api_key',
  };
}

/**
 * Check if API key has required permissions
 */
export function checkPermissions(apiKey: APIKey, requiredPermissions: Permission[]): boolean {
  const apiKeyService = new APIKeyService();
  
  // Admin has all permissions
  if (apiKey.permissions.includes('admin')) {
    return true;
  }

  // Check each required permission
  return requiredPermissions.every(permission => 
    apiKeyService.hasPermission(apiKey, permission)
  );
}

/**
 * Check if request IP is allowed
 */
export function checkAllowedIP(apiKey: APIKey, request: NextRequest): boolean {
  if (!apiKey.allowed_ips || apiKey.allowed_ips.length === 0) {
    return true; // No IP restrictions
  }

  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip')
    || 'unknown';

  return apiKey.allowed_ips.includes(clientIP);
}

/**
 * Check if request origin is allowed
 */
export function checkAllowedOrigin(apiKey: APIKey, request: NextRequest): boolean {
  if (!apiKey.allowed_origins || apiKey.allowed_origins.length === 0) {
    return true; // No origin restrictions
  }

  const origin = request.headers.get('origin') || '';
  
  return apiKey.allowed_origins.some(allowed => {
    // Support wildcard matching
    if (allowed.includes('*')) {
      const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
      return regex.test(origin);
    }
    return allowed === origin;
  });
}

// ============================================
// Middleware Functions
// ============================================

/**
 * Authenticate request using API key
 * Returns AuthResult with authentication status and details
 */
export async function authenticateRequest(
  request: NextRequest,
  options: MiddlewareOptions = {}
): Promise<AuthResult> {
  const { requiredPermissions = [], allowSession = true } = options;

  // Try API key authentication first
  const apiKeySecret = extractAPIKeyFromHeader(request);
  
  if (apiKeySecret) {
    // Validate API key
    const authResult = await validateAPIKey(apiKeySecret);
    
    if (!authResult.authenticated) {
      return authResult;
    }

    const apiKey = authResult.apiKey!;

    // Check IP restrictions
    if (!checkAllowedIP(apiKey, request)) {
      return {
        authenticated: false,
        error: 'IP address not allowed',
        statusCode: 403,
      };
    }

    // Check origin restrictions
    if (!checkAllowedOrigin(apiKey, request)) {
      return {
        authenticated: false,
        error: 'Origin not allowed',
        statusCode: 403,
      };
    }

    // Check permissions
    if (requiredPermissions.length > 0 && !checkPermissions(apiKey, requiredPermissions)) {
      return {
        authenticated: false,
        error: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        statusCode: 403,
      };
    }

    return authResult;
  }

  // No API key found
  if (!allowSession) {
    return {
      authenticated: false,
      error: 'API key required',
      statusCode: 401,
    };
  }

  // Fall back to session authentication (handled by caller)
  return {
    authenticated: false,
    error: 'No API key provided',
    authMethod: 'session',
  };
}

/**
 * Create authentication middleware response
 */
export function createAuthErrorResponse(result: AuthResult): NextResponse {
  return NextResponse.json(
    {
      error: result.statusCode === 401 ? 'Unauthorized' : 'Forbidden',
      message: result.error,
    },
    { status: result.statusCode || 401 }
  );
}

/**
 * Log API key usage after request completion
 */
export async function logAPIKeyUsage(
  apiKey: APIKey,
  request: NextRequest,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  const apiKeyService = new APIKeyService();
  
  await apiKeyService.logUsage({
    api_key_id: apiKey.id,
    endpoint: new URL(request.url).pathname,
    method: request.method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || undefined,
    user_agent: request.headers.get('user-agent') || undefined,
  });
}

// ============================================
// Higher-Order Function for Route Protection
// ============================================

type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Wrap a route handler with API key authentication
 */
export function withAPIKeyAuth(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const startTime = Date.now();
    
    // Authenticate request
    const authResult = await authenticateRequest(request, options);
    
    // If API key auth failed and session fallback is not allowed
    if (!authResult.authenticated && !options.allowSession) {
      return createAuthErrorResponse(authResult);
    }

    // If API key auth succeeded, attach to request
    const authenticatedRequest = request as AuthenticatedRequest;
    if (authResult.authenticated && authResult.apiKey) {
      authenticatedRequest.apiKey = authResult.apiKey;
      authenticatedRequest.ownerAddress = authResult.ownerAddress;
      authenticatedRequest.authMethod = 'api_key';
    }

    // Call the handler
    const response = await handler(authenticatedRequest, context);

    // Log API key usage if authenticated via API key
    if (authResult.authenticated && authResult.apiKey) {
      const responseTime = Date.now() - startTime;
      // Fire and forget - don't block response
      logAPIKeyUsage(authResult.apiKey, request, response.status, responseTime).catch(err => {
        console.error('[APIKeyAuth] Failed to log usage:', err);
      });
    }

    return response;
  };
}
