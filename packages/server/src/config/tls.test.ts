import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { createTlsConfig, validateTlsConfig, TlsConfig } from './tls.js';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('TLS Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.SSL_ENABLED;
    delete process.env.SSL_KEY_PATH;
    delete process.env.SSL_CERT_PATH;
    delete process.env.HTTPS_PORT;
  });

  describe('createTlsConfig', () => {
    it('should return null when SSL is disabled', () => {
      process.env.SSL_ENABLED = 'false';
      
      const config = createTlsConfig();
      
      expect(config).toBeNull();
    });

    it('should return null when SSL_ENABLED is not set', () => {
      const config = createTlsConfig();
      
      expect(config).toBeNull();
    });

    it('should create valid TLS config when SSL is enabled with valid paths', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';
      process.env.HTTPS_PORT = '4128';

      const mockKey = 'mock-private-key';
      const mockCert = 'mock-certificate';
      
      mockFs.readFileSync
        .mockReturnValueOnce(mockKey)
        .mockReturnValueOnce(mockCert);
      mockFs.existsSync.mockReturnValue(true);

      const config = createTlsConfig();

      expect(config).toEqual({
        enabled: true,
        key: mockKey,
        cert: mockCert,
        port: 4128,
        keyPath: '/path/to/key.pem',
        certPath: '/path/to/cert.pem'
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/key.pem', 'utf8');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/cert.pem', 'utf8');
    });

    it('should use default HTTPS port when not specified', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';

      mockFs.readFileSync.mockReturnValue('mock-content');
      mockFs.existsSync.mockReturnValue(true);

      const config = createTlsConfig();

      expect(config?.port).toBe(4128); // Default HTTPS port
    });

    it('should throw error when key file does not exist', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/nonexistent/key.pem';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';

      mockFs.existsSync
        .mockReturnValueOnce(false) // key file doesn't exist
        .mockReturnValueOnce(true);  // cert file exists

      expect(() => createTlsConfig()).toThrow('SSL key file not found: /nonexistent/key.pem');
    });

    it('should throw error when certificate file does not exist', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';
      process.env.SSL_CERT_PATH = '/nonexistent/cert.pem';

      mockFs.existsSync
        .mockImplementationOnce((path) => path === '/path/to/key.pem')   // key file exists
        .mockImplementationOnce((path) => path !== '/nonexistent/cert.pem'); // cert file doesn't exist

      expect(() => createTlsConfig()).toThrow('SSL certificate file not found: /nonexistent/cert.pem');
    });

    it('should throw error when SSL_KEY_PATH is missing', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';

      expect(() => createTlsConfig()).toThrow('SSL_KEY_PATH environment variable is required when SSL is enabled');
    });

    it('should throw error when SSL_CERT_PATH is missing', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';

      expect(() => createTlsConfig()).toThrow('SSL_CERT_PATH environment variable is required when SSL is enabled');
    });

    it('should handle file reading errors gracefully', () => {
      process.env.SSL_ENABLED = 'true';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied, open \'/path/to/key.pem\'');
      });

      expect(() => createTlsConfig()).toThrow('Failed to read SSL key file: EACCES: permission denied');
    });
  });

  describe('validateTlsConfig', () => {
    it('should return true for valid configuration', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKoK/OvH0DDhMA0GCSqGSIb3DQEBCwUA...\n-----END CERTIFICATE-----\n',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).not.toThrow();
      expect(validateTlsConfig(config)).toBe(true);
    });

    it('should throw error for empty key content', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL key content is empty or invalid');
    });

    it('should throw error for whitespace-only key content', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '   \n\t  ',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL key content is empty or invalid');
    });

    it('should throw error for empty certificate content', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
        cert: '',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL certificate content is empty or invalid');
    });

    it('should throw error for whitespace-only certificate content', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
        cert: '   \n\t  ',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL certificate content is empty or invalid');
    });

    it('should throw error for invalid private key format', () => {
      const config: TlsConfig = {
        enabled: true,
        key: 'this is not a valid private key format',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL key file does not appear to contain a valid private key');
    });

    it('should accept RSA private key format', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).not.toThrow();
    });

    it('should throw error for invalid certificate format', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
        cert: 'this is not a valid certificate format',
        port: 443,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('SSL certificate file does not appear to contain a valid certificate');
    });

    it('should throw error for port number too low', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 0,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('Invalid HTTPS port: 0. Must be between 1 and 65535');
    });

    it('should throw error for port number too high', () => {
      const config: TlsConfig = {
        enabled: true,
        key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
        port: 65536,
        keyPath: '/etc/ssl/key.pem',
        certPath: '/etc/ssl/cert.pem'
      };

      expect(() => validateTlsConfig(config)).toThrow('Invalid HTTPS port: 65536. Must be between 1 and 65535');
    });

    it('should accept valid port ranges', () => {
      const testPorts = [1, 80, 443, 8080, 8443, 65535];
      
      testPorts.forEach(port => {
        const config: TlsConfig = {
          enabled: true,
          key: '-----BEGIN PRIVATE KEY-----\nvalid key\n-----END PRIVATE KEY-----\n',
          cert: '-----BEGIN CERTIFICATE-----\nvalid cert\n-----END CERTIFICATE-----\n',
          port: port,
          keyPath: '/etc/ssl/key.pem',
          certPath: '/etc/ssl/cert.pem'
        };

        expect(() => validateTlsConfig(config)).not.toThrow();
      });
    });
  });

  describe('TlsConfig interface', () => {
    it('should have required properties', () => {
      const config: TlsConfig = {
        enabled: true,
        key: 'test-key',
        cert: 'test-cert',
        port: 4128,
        keyPath: '/test/key.pem',
        certPath: '/test/cert.pem'
      };

      expect(config.enabled).toBe(true);
      expect(config.key).toBe('test-key');
      expect(config.cert).toBe('test-cert');
      expect(config.port).toBe(4128);
      expect(config.keyPath).toBe('/test/key.pem');
      expect(config.certPath).toBe('/test/cert.pem');
    });
  });
});