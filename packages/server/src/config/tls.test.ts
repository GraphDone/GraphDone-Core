import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { createTlsConfig, TlsConfig } from './tls.js';

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