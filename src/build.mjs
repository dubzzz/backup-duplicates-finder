// @ts-check
import path from 'path';
import fs from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import './internals/errorHandling.mjs';
import { cachedScanDirectory } from './internals/cachedScan.mjs';

const argv = await yargs(hideBin(process.argv))
  .command(
    'yarn build <path>',
    'build cache for <path>',
    () => {},
    (argv) => console.info(argv),
  )
  .option('incremental', {
    alias: 'i',
    type: 'boolean',
    description: 'Force to rebuild the cache but incrementally if we already know hashes',
  })
  .option('no-fail', {
    type: 'boolean',
    description: 'Ignore failures occuring when traversing the tree of files',
  })
  .option('dig', {
    default: 0,
    type: 'number',
    description: 'Scan leaves at depth {dig} first',
  })
  .demandCommand(1)
  .parse();

const dig = argv['dig'] ?? 0;
const isIncremental = !!argv['incremental'];
const continueOnFailure = argv['fail'] !== false;
const paths = argv._;

const options = { isIncremental, continueOnFailure, withHash: true };

async function deeper(depth, pathToBeScanned) {
  if (depth <= 0) {
    await cachedScanDirectory(String(pathToBeScanned), options);
    return;
  }
  const files = await fs.readdir(pathToBeScanned, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      await deeper(depth - 1, path.join(pathToBeScanned, file.name));
    }
  }
  await cachedScanDirectory(String(pathToBeScanned), options);
}

for (const path of paths) {
  await deeper(dig, String(path));
}
