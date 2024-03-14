// @ts-check
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
  .demandCommand(1)
  .parse();

const isIncremental = !!argv['incremental'];
const continueOnFailure = argv['fail'] !== false;
const paths = argv._;

for (const path of paths) {
  await cachedScanDirectory(String(path), { isIncremental, continueOnFailure, withHash: true });
}
