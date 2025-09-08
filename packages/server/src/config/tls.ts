import fs from 'fs';

export interface TlsConfig {
  enabled: true;
  key: string;
  cert: string;
  port: number;
  keyPath: string;
  certPath: string;
}

/**
 * Create TLS configuration from environment variables
 * @returns TlsConfig object if SSL is enabled, null otherwise
 * @throws Error if SSL is enabled but configuration is invalid
 */
export function createTlsConfig(): TlsConfig | null {
  const sslEnabled = process.env.SSL_ENABLED?.toLowerCase() === 'true';
  
  if (!sslEnabled) {
    return null;
  }

  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  const httpsPort = parseInt(process.env.HTTPS_PORT || '4128', 10);

  // Validate required environment variables
  if (!keyPath) {
    throw new Error('SSL_KEY_PATH environment variable is required when SSL is enabled');
  }

  if (!certPath) {
    throw new Error('SSL_CERT_PATH environment variable is required when SSL is enabled');
  }

  // Check if files exist
  if (!fs.existsSync(keyPath)) {
    throw new Error(`SSL key file not found: ${keyPath}`);
  }

  if (!fs.existsSync(certPath)) {
    throw new Error(`SSL certificate file not found: ${certPath}`);
  }

  try {
    // Read SSL files
    const key = fs.readFileSync(keyPath, 'utf8');
    const cert = fs.readFileSync(certPath, 'utf8');

    return {
      enabled: true,
      key,
      cert,
      port: httpsPort,
      keyPath,
      certPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read SSL key file: ${errorMessage}`);
  }
}

/**
 * Validate TLS configuration
 * @param config TLS configuration object
 * @returns true if valid, throws error otherwise
 */
export function validateTlsConfig(config: TlsConfig): boolean {
  if (!config.key || config.key.trim() === '') {
    throw new Error('SSL key content is empty or invalid');
  }

  if (!config.cert || config.cert.trim() === '') {
    throw new Error('SSL certificate content is empty or invalid');
  }

  if (!config.key.includes('BEGIN PRIVATE KEY') && !config.key.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error('SSL key file does not appear to contain a valid private key');
  }

  if (!config.cert.includes('BEGIN CERTIFICATE')) {
    throw new Error('SSL certificate file does not appear to contain a valid certificate');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid HTTPS port: ${config.port}. Must be between 1 and 65535`);
  }

  return true;
}