#!/usr/bin/env node
import { startServer } from './lib/server.mjs';
import { parseArgs, isMain } from './lib/common.mjs';
if (isMain(import.meta.url)) {
  const args = parseArgs();
  try {
    const server = await startServer(args._[0] || 'out/horse', Number(args.port || 4173));
    console.log(`Creature viewer: ${server.url}\nServing ${server.root}`);
    const stop = async () => { await server.close(); process.exit(0); }; process.on('SIGINT', stop); process.on('SIGTERM', stop);
  } catch (error) { console.error(error.message); console.error('Build a creature first: node scripts/build.mjs examples/horse.json --out out/horse'); process.exitCode = 1; }
}
