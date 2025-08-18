#!/usr/bin/env node

// Quick test to verify our graph integration is working
const puppeteer = require('puppeteer');

async function testGraphIntegration() {
  let browser;
  try {
    console.log('🚀 Testing GraphDone Graph Integration...');
    
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:3127...');
    await page.goto('http://localhost:3127', { waitUntil: 'networkidle2' });
    
    // Wait for the app to load
    await page.waitForTimeout(3000);
    
    // Look for graph names in the UI
    console.log('🔍 Looking for modern project names...');
    
    // Check if we can find our modern project names
    const healthcareProject = await page.$x("//text()[contains(., 'AI-Powered Healthcare Platform')]");
    const climateProject = await page.$x("//text()[contains(., 'Global Climate Intelligence Platform')]");
    const quantumProject = await page.$x("//text()[contains(., 'Quantum Cloud Computing Platform')]");
    
    if (healthcareProject.length > 0) {
      console.log('✅ Found Healthcare AI project in UI');
    } else {
      console.log('❌ Healthcare AI project not found in UI');
    }
    
    if (climateProject.length > 0) {
      console.log('✅ Found Climate Tech project in UI');
    } else {
      console.log('❌ Climate Tech project not found in UI');
    }
    
    if (quantumProject.length > 0) {
      console.log('✅ Found Quantum Computing project in UI');
    } else {
      console.log('❌ Quantum Computing project not found in UI');
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'test-artifacts/graph-integration-test.png', fullPage: true });
    console.log('📸 Screenshot saved to test-artifacts/graph-integration-test.png');
    
    // Wait a bit for observation
    console.log('⏳ Waiting 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error testing graph integration:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testGraphIntegration();