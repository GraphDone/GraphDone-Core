import './config/environment.js';

process.env.NODE_ENV ??= 'development';
await import('./index.js');
