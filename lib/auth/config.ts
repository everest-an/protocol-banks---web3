/**
 * Auth Configuration
 */

export const AUTH_CONFIG = {
  // Magic Link settings
  magicLink: {
    expiresInMinutes: 15,
    maxAttempts: 5,
    cooldownMinutes: 1,
  },

  // Session settings
  session: {
    expiresInDays: 30,
    refreshThresholdDays: 7,
    cookieName: "pb_session",
  },

  // PIN settings
  pin: {
    length: 6,
    pbkdf2Iterations: 100000,
  },

  // Recovery settings
  recovery: {
    expiresInHours: 24,
    maxAttempts: 3,
  },

  // Email settings
  email: {
    fromAddress: "noreply@protocolbank.io",
    fromName: "Protocol Bank",
  },
}

export const SUPPORTED_OAUTH_PROVIDERS = ["google", "apple"] as const
export type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number]
