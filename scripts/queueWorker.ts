import { startQueueWorker } from '@/server/socket';

async function main() {
  const runtime = await startQueueWorker();
  console.log(`Realtime queue worker running on port ${runtime.port}`);
}

main().catch((error) => {
  console.error('Failed to start queue worker', error);
  process.exit(1);
});
