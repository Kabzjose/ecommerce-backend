import 'dotenv/config';
import { env } from '../src/config/env.js';
import { sendSms } from '../src/lib/sms.js';

const testPhone = process.argv[2] ?? '+254718047199';
const msg = `ChapChap SMS test — ${new Date().toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' })}`;

console.log('\n── Africa\'s Talking SMS Test ──────────────────────────────');
console.log(`Mode:        ${env.AT_USERNAME === 'sandbox' ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Sending to:  ${testPhone}`);
console.log(`Message:     "${msg}"`);
console.log(`API key:     ${env.AT_API_KEY.slice(0, 12)}...`);
console.log('─────────────────────────────────────────────────────────\n');

const result = await sendSms(testPhone, msg);

if (result.success) {
  console.log('✅  SUCCESS — SMS sent');
} else {
  console.error('❌  FAILED:', result.errorMessage);
  process.exit(1);
}
