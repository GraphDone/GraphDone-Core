const knownInsecureSecrets = new Set([
  'your-dev-secret-key',
  'your-secret-key',
  'your-secret',
  'your-secret-key-change-in-production',
  'graphdone-default-secret-change-in-production',
  'your-secret-key-change-this-in-production',
  'your-session-secret-change-this-in-production',
  'your-jwt-secret-here',
  'your-super-secret-jwt-key-change-in-production',
  'your-secure-jwt-secret-here',
  'your-super-secure-random-jwt-secret-256-bits-long',
  'your-super-secret-random-32-byte-hex-string-here',
  'your-256-bit-secret-key',
  'your-secure-secret',
]);

export function validateProductionSecrets(environment: Record<string, string | undefined>): void {
  if (environment.NODE_ENV !== 'production') return;

  const invalid = ['JWT_SECRET', 'SESSION_SECRET'].filter(name => {
    const value = environment[name]?.trim();
    return !value || knownInsecureSecrets.has(value.toLowerCase());
  });

  if (invalid.length) {
    throw new Error(`Invalid production secrets: ${invalid.join(', ')}. Configure independent random secrets before starting the API.`);
  }
}
