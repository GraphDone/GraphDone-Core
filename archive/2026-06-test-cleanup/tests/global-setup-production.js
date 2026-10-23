// Global setup for production E2E tests
async function globalSetup() {
  console.log('🔧 Setting up production E2E testing environment...');
  
  // Verify the production server is running
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://localhost:3128/health', {
      headers: { 'Accept': 'application/json' },
      // Accept self-signed certificates
      agent: new (require('https')).Agent({
        rejectUnauthorized: false
      })
    });
    
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Production server is healthy:', health);
    } else {
      console.error('❌ Production server health check failed:', response.status);
      throw new Error('Production server is not healthy');
    }
  } catch (error) {
    console.error('❌ Failed to connect to production server:', error.message);
    console.error('   Make sure the production deployment is running with: ./start deploy');
    throw error;
  }
  
  console.log('✅ Production E2E setup completed');
}

module.exports = globalSetup;