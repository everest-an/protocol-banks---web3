/**
 * ProtocolBanks MCP Server - Subscription Tools
 * 
 * MCP tools for subscription management.
 */

import type { PaidServer } from '../server';
import { SubscriptionService, SubscriptionError } from '../services/subscription.service';
import { Logger } from '../utils/logger';

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register subscription management tools on the MCP server
 */
export function registerSubscriptionTools(
  server: PaidServer,
  subscriptionService: SubscriptionService,
  logger?: Logger
): void {
  const log = logger || new Logger({ level: 'info', prefix: 'SubscriptionTools' });

  // --------------------------------------------------------------------------
  // list_subscriptions - List all available plans (FREE)
  // --------------------------------------------------------------------------
  server.tool(
    'list_subscriptions',
    'List all available subscription plans with pricing information',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      log.debug('Listing subscription plans');
      try {
        const plans = await subscriptionService.listPlans();
        return { plans };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  // --------------------------------------------------------------------------
  // get_subscription_info - Get plan details (FREE)
  // --------------------------------------------------------------------------
  server.tool(
    'get_subscription_info',
    'Get detailed information about a specific subscription plan',
    {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The ID of the subscription plan',
        },
      },
      required: ['planId'],
    },
    async (args: { planId: string }) => {
      log.debug(`Getting plan info: ${args.planId}`);
      try {
        const plan = await subscriptionService.getPlan(args.planId);
        if (!plan) {
          return {
            error: true,
            code: 'PLAN_NOT_FOUND',
            message: `Plan '${args.planId}' not found`,
          };
        }
        return { plan };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  // --------------------------------------------------------------------------
  // subscribe - Subscribe to a plan (PAID - triggers 402)
  // --------------------------------------------------------------------------
  // Note: The price is dynamic based on the plan, but we set a default here.
  // The actual price should be fetched from the plan and used in the 402 response.
  server.paidTool(
    'subscribe',
    'Subscribe to a plan. Requires payment authorization.',
    '$9.99', // Default price, actual price comes from plan
    {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The ID of the subscription plan to subscribe to',
        },
        walletAddress: {
          type: 'string',
          description: 'Your wallet address for the subscription',
        },
      },
      required: ['planId', 'walletAddress'],
    },
    async (args: { planId: string; walletAddress: string }) => {
      log.info(`Creating subscription: plan=${args.planId}, wallet=${args.walletAddress}`);
      try {
        // Validate wallet address
        if (!isValidEthereumAddress(args.walletAddress)) {
          return {
            error: true,
            code: 'INVALID_WALLET_ADDRESS',
            message: 'Invalid Ethereum wallet address',
          };
        }

        const subscription = await subscriptionService.createSubscription(
          args.planId,
          args.walletAddress
        );

        return {
          subscription,
          message: 'Subscription created successfully. Payment has been processed.',
        };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  // --------------------------------------------------------------------------
  // check_subscription - Check subscription status (FREE)
  // --------------------------------------------------------------------------
  server.tool(
    'check_subscription',
    'Check the status of a subscription',
    {
      type: 'object',
      properties: {
        subscriptionId: {
          type: 'string',
          description: 'The ID of the subscription to check',
        },
      },
      required: ['subscriptionId'],
    },
    async (args: { subscriptionId: string }) => {
      log.debug(`Checking subscription: ${args.subscriptionId}`);
      try {
        const subscription = await subscriptionService.getSubscription(args.subscriptionId);
        if (!subscription) {
          return {
            error: true,
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: `Subscription '${args.subscriptionId}' not found`,
          };
        }
        return { subscription };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  // --------------------------------------------------------------------------
  // cancel_subscription - Cancel a subscription (FREE)
  // --------------------------------------------------------------------------
  server.tool(
    'cancel_subscription',
    'Cancel an active subscription',
    {
      type: 'object',
      properties: {
        subscriptionId: {
          type: 'string',
          description: 'The ID of the subscription to cancel',
        },
      },
      required: ['subscriptionId'],
    },
    async (args: { subscriptionId: string }) => {
      log.info(`Cancelling subscription: ${args.subscriptionId}`);
      try {
        const subscription = await subscriptionService.cancelSubscription(args.subscriptionId);
        return {
          subscription,
          message: 'Subscription cancelled successfully',
        };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  // --------------------------------------------------------------------------
  // get_my_subscriptions - Get user's subscriptions (FREE)
  // --------------------------------------------------------------------------
  server.tool(
    'get_my_subscriptions',
    'Get all subscriptions for a wallet address',
    {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address',
        },
      },
      required: ['walletAddress'],
    },
    async (args: { walletAddress: string }) => {
      log.debug(`Getting subscriptions for: ${args.walletAddress}`);
      try {
        if (!isValidEthereumAddress(args.walletAddress)) {
          return {
            error: true,
            code: 'INVALID_WALLET_ADDRESS',
            message: 'Invalid Ethereum wallet address',
          };
        }

        const subscriptions = await subscriptionService.getUserSubscriptions(args.walletAddress);
        return { subscriptions };
      } catch (error) {
        return handleError(error, log);
      }
    }
  );

  log.info('Registered 6 subscription tools');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Handle errors and return structured error response
 */
function handleError(error: unknown, logger: Logger): object {
  if (error instanceof SubscriptionError) {
    logger.warn(`Subscription error: ${error.code} - ${error.message}`);
    return {
      error: true,
      code: error.code,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`Unexpected error: ${message}`);
  return {
    error: true,
    code: 'INTERNAL_ERROR',
    message,
  };
}
