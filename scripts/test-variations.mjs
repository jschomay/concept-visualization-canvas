#!/usr/bin/env node

// Manual test script for variations generation logic
// Run with: npm run test:variations

// Load environment variables from .env.local
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from the project root
config({ path: join(__dirname, '..', '.env.local') });

// Import the generation logic directly
import { generateVariations } from '../src/lib/variations.ts';

const testPrompts = [
  "a cat sitting on a windowsill",
  "abstract geometric shapes in blue and gold",
  "vintage bicycle in a sunny meadow",
  "steampunk robot playing chess",
  "minimalist coffee shop interior"
];

async function testVariations(prompt) {
  console.log(`\n🧪 Testing prompt: "${prompt}"`);
  console.log('='.repeat(60));

  try {
    const variations = await generateVariations(prompt);

    console.log(`✅ Success! Generated ${variations.length} variations:`);
    variations.forEach((variation, index) => {
      console.log(`  ${index + 1}. ${variation}`);
    });

    const isCorrectFormat = variations.length === 4;
    console.log(`📊 Format check: ${isCorrectFormat ? '✅' : '❌'} (${variations.length}/4 lines)`);

    return { success: true, lineCount: variations.length };

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.message.includes('API key') || error.message.includes('401')) {
      console.log('💡 This looks like an API key issue - check your OPENAI_API_KEY in .env.local');
    }
    return { success: false, lineCount: 0 };
  }
}

async function runTests() {
  console.log('🚀 Starting variations generation tests...');
  console.log('Testing the generation logic directly (no server needed)\n');

  let totalTests = 0;
  let successfulTests = 0;
  let correctFormatTests = 0;

  for (const prompt of testPrompts) {
    totalTests++;
    const result = await testVariations(prompt);

    if (result.success) {
      successfulTests++;
      if (result.lineCount === 4) {
        correctFormatTests++;
      }
    }

    // Add a small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📈 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}/${totalTests} (${Math.round(successfulTests / totalTests * 100)}%)`);
  console.log(`Correct format: ${correctFormatTests}/${totalTests} (${Math.round(correctFormatTests / totalTests * 100)}%)`);

  if (successfulTests === 0) {
    console.log('\n💡 Troubleshooting tips:');
    console.log('- Verify OPENAI_API_KEY is set in .env.local');
    console.log('- Make sure the API key is valid and has credits');
    console.log('- Try a simple test with curl to verify the key works');
  } else if (correctFormatTests < successfulTests) {
    console.log('\n💡 Prompt quality notes:');
    console.log('- Some responses may not be exactly 4 lines');
    console.log('- Consider adjusting the prompt for more consistent formatting');
  }
}

// Run the tests
runTests().catch(console.error);
