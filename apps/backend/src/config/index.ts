import path from 'path';

import dotenv from 'dotenv';

// Load environment variables from multiple candidate locations to support running from subfolders
const envName = process.env.NODE_ENV || 'development';
const envFile = `.env.${envName}`;

// Candidate roots: repo root (relative to this file), process.cwd()
const repoRoot = path.resolve(__dirname, '../../..');
const candidates = [
  path.join(repoRoot, envFile),
  path.join(repoRoot, '.env'),
  path.resolve(process.cwd(), envFile),
  path.resolve(process.cwd(), '.env'),
];

for (const p of candidates) {
  dotenv.config({ path: p });
}

interface Config {
  nodeEnv: string;
  port: number;
  logLevel: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  s3: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  github: {
    clientId: string;
    clientSecret: string;
  };
  airia: {
    apiUrl: string;
    apiKey: string;
  };
  openRouter: {
    apiKey: string;
  };
  retell: {
    apiUrl: string;
    apiKey: string;
    webhookSecret?: string;
  };
  modal: {
    apiKey: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    sessionExpiryHours: number;
    oidc: {
      issuer: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
    webauthn: {
      rpName: string;
      rpId: string;
      origin: string;
    };
  };
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'onboarding_agent',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'onboarding-artifacts',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  },
  airia: {
    apiUrl: process.env.AIRIA_API_URL || '',
    apiKey: process.env.AIRIA_API_KEY || '',
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
  },
  retell: {
    apiUrl: process.env.RETELL_API_URL || 'https://api.retellai.com/v1',
    apiKey: process.env.RETELL_API_KEY || '',
    webhookSecret: process.env.RETELL_WEBHOOK_SECRET,
  },
  modal: {
    apiKey: process.env.MODAL_API_KEY || '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || '8', 10),
    oidc: {
      issuer: process.env.OIDC_ISSUER || '',
      clientId: process.env.OIDC_CLIENT_ID || '',
      clientSecret: process.env.OIDC_CLIENT_SECRET || '',
      redirectUri: process.env.OIDC_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    },
    webauthn: {
      rpName: process.env.WEBAUTHN_RP_NAME || 'Codebase Onboarding Agent',
      rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3001',
    },
  },
};
