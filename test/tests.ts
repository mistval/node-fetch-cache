// eslint-disable-next-line import/no-unassigned-import,import/order
import 'dotenv/config.js';
import util from 'util';

const httpBinBaseUrl = 'http://localhost:3000';
const wait = util.promisify(setTimeout);

const TWO_HUNDRED_URL = `${httpBinBaseUrl}/status/200`;

async function runPingLoop() {
  while (true) {
    const startTime = Date.now();
    try {
      await fetch(TWO_HUNDRED_URL);
    } catch (err) {
      console.log('HTTP bin error ', (err as any).message);
    }

    const endTime = Date.now();
    const difference = endTime - startTime;

    if (difference > 1000) {
      console.log('HTTP bin container response time:', endTime - startTime, 'ms');
    }
  }
}

runPingLoop();
await wait(180_000);
