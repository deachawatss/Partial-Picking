#!/usr/bin/env node

/**
 * Environment Configuration Script for PK Frontend
 *
 * This script reads configuration from the root .env file and updates
 * the Angular environment files to use dynamic values instead of hardcoded ones.
 *
 * Usage:
 * node scripts/env-config.js [environment]
 *
 * Environment: development (default) | production
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_ENV_FILE = path.join(__dirname, '../../../.env');
const ENVIRONMENTS_DIR = path.join(__dirname, '../src/environments');

const ENV_MAPPINGS = {
  // API Configuration
  API_BASE_URL: 'apiUrl',
  BACKEND_URL: 'backendUrl',
  BRIDGE_SERVICE_URL: 'bridgeServiceUrl',

  // Database Configuration
  DATABASE_NAME: 'primaryDatabase',
  SCALE_DB_NAME: 'scaleDatabase',

  // Service Ports
  FRONTEND_PORT: 'frontendPort',
  BACKEND_PORT: 'backendPort',
  BRIDGE_SERVICE_PORT: 'bridgeServicePort',

  // Hardware Configuration
  DEFAULT_SCALE_BAUD_RATE: 'defaultScaleBaudRate',
  WEIGHT_POLLING_INTERVAL_MS: 'weightPollingInterval',
  WEBSOCKET_MAX_RESPONSE_TIME: 'websocketMaxResponseTime',

  // Authentication Configuration
  AUTH_TOKEN_KEY: 'jwtTokenKey',
  SESSION_TIMEOUT_HOURS: 'sessionTimeoutHours',

  // Feature Flags
  ENABLE_MULTI_SCALE: 'multiScaleSupport',
  ENABLE_WEBSOCKETS: 'enableWebsockets',
  DEBUG_MODE: 'debugMode',

  // App Information
  APP_NAME: 'appName',
  APP_VERSION: 'appVersion',
  COMPANY_NAME: 'companyName'
};

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach(line => {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const [key, ...valueParts] = trimmedLine.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key.trim()] = value;
    }
  });

  return env;
}

function loadEnvironmentVariables() {
  if (!fs.existsSync(ROOT_ENV_FILE)) {
    console.error('❌ Root .env file not found:', ROOT_ENV_FILE);
    process.exit(1);
  }

  try {
    return parseEnvFile(ROOT_ENV_FILE);
  } catch (error) {
    console.error('❌ Error loading .env file:', error.message);
    process.exit(1);
  }
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shouldAppendPort(protocol, port) {
  if (!port) {
    return false;
  }

  if (protocol === 'http' && port === 80) {
    return false;
  }

  if (protocol === 'https' && port === 443) {
    return false;
  }

  return true;
}

function formatBaseUrl(protocol, host, port) {
  const cleanProtocol = (protocol || 'http').replace(/:$/, '').toLowerCase();
  const cleanHost = host || '127.0.0.1';
  const portSegment = shouldAppendPort(cleanProtocol, port) ? `:${port}` : '';
  return `${cleanProtocol}://${cleanHost}${portSegment}`;
}

function resolveApiUrl(rawApiUrl, backendBaseUrl) {
  if (!rawApiUrl || rawApiUrl.trim() === '') {
    return '/api';
  }

  const trimmed = rawApiUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  const normalizedBackend = backendBaseUrl.replace(/\/$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${normalizedBackend}${normalizedPath}`;
}

function generateEnvironmentConfig(env, isProd = false) {
  const frontendPort = toInt(env.FRONTEND_PORT, 6060);
  const backendPort = toInt(env.BACKEND_PORT, 7070);
  const bridgePort = toInt(env.BRIDGE_SERVICE_PORT, 5000);

  const backendProtocol = (env.BACKEND_PROTOCOL || 'http').replace(/:$/, '');
  const backendHost = env.BACKEND_HOST || '127.0.0.1';
  const backendBaseUrl = env.BACKEND_URL || formatBaseUrl(backendProtocol, backendHost, backendPort);

  const bridgeProtocol = (env.BRIDGE_PROTOCOL || backendProtocol).replace(/:$/, '');
  const bridgeHost = env.BRIDGE_HOST || backendHost;
  const bridgeBaseUrl = env.BRIDGE_SERVICE_URL || formatBaseUrl(bridgeProtocol, bridgeHost, bridgePort);

  const apiUrl = resolveApiUrl(env.API_BASE_URL, backendBaseUrl);

  const config = {
    production: isProd,

    // API / Service URLs
    apiUrl,
    backendUrl: backendBaseUrl,
    bridgeServiceUrl: bridgeBaseUrl,
    frontendPort,
    backendPort,
    bridgeServicePort: bridgePort,

    // Database Configuration
    primaryDatabase: env.DATABASE_NAME || 'TFCPILOT3',
    scaleDatabase: env.SCALE_DB_NAME || 'TFCPILOT3',

    // Authentication Configuration
    jwtTokenKey: env.AUTH_TOKEN_KEY || 'pk_auth_token',
    sessionTimeout: (toInt(env.SESSION_TIMEOUT_HOURS, 24) * 60 * 60 * 1000),

    // Hardware Configuration
    defaultScaleBaudRate: toInt(env.DEFAULT_SCALE_BAUD_RATE, 9600),
    weightPollingInterval: toInt(env.WEIGHT_POLLING_INTERVAL_MS, 400),
    websocketMaxResponseTime: toInt(env.WEBSOCKET_MAX_RESPONSE_TIME, 100),

    // Feature Flags (convert to booleans)
    features: {
      multiScaleSupport: env.ENABLE_MULTI_SCALE === 'true',
      autoScaleDetection: true,
      sessionTimeout: true,
      connectionMonitoring: true,
      accessibility: true,
      animations: !isProd
    },

    // Logging Configuration
    logging: {
      level: isProd ? 'warn' : 'debug',
      enableConsoleLog: env.DEBUG_MODE === 'true' || !isProd,
      enableApiLog: env.DEBUG_MODE === 'true' || !isProd
    },

    // UI Configuration
    ui: {
      theme: 'nwfth-brown',
      animationsEnabled: !isProd,
      touchOptimized: true,
      minTouchTargetSize: 44
    },

    // Application Information
    app: {
      name: env.APP_NAME || 'Partial Picking System',
      version: env.APP_VERSION || '1.0.0',
      company: env.COMPANY_NAME || 'Newly Weds Foods Thailand'
    }
  };

  return config;
}

function writeEnvironmentFile(filePath, config) {
  const fileContent = `// Auto-generated environment configuration
// Generated on: ${new Date().toISOString()}
// Source: ${ROOT_ENV_FILE}
// DO NOT EDIT - This file is automatically generated from .env

export const environment = ${JSON.stringify(config, null, 2)};
`;

  fs.writeFileSync(filePath, fileContent, 'utf8');
}

function main() {
  const targetEnv = process.argv[2] || 'development';
  const isProd = targetEnv === 'production';

  console.log(`🔧 Configuring Angular environment for: ${targetEnv}`);
  console.log(`📂 Reading configuration from: ${ROOT_ENV_FILE}`);

  // Load environment variables
  const env = loadEnvironmentVariables();

  // Generate configuration
  const config = generateEnvironmentConfig(env, isProd);

  // Determine output file
  const envFileName = isProd ? 'environment.prod.ts' : 'environment.ts';
  const outputPath = path.join(ENVIRONMENTS_DIR, envFileName);

  // Write environment file
  writeEnvironmentFile(outputPath, config);

  console.log(`✅ Generated ${envFileName}`);
  console.log(`📍 Location: ${outputPath}`);
  console.log('\n📋 Configuration summary:');
  console.log(`   API URL: ${config.apiUrl}`);
  console.log(`   Backend URL: ${config.backendUrl}`);
  console.log(`   Frontend Port: ${config.frontendPort}`);
  console.log(`   Backend Port: ${config.backendPort}`);
  console.log(`   Primary DB: ${config.primaryDatabase}`);
  console.log(`   Production: ${config.production}`);

  console.log('\n🎉 Environment configuration complete!');
}

if (require.main === module) {
  main();
}

module.exports = { main, generateEnvironmentConfig, loadEnvironmentVariables };
