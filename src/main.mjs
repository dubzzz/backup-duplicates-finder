// @ts-check
import * as url from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import './internals/errorHandling.mjs';
import { cachedScanDirectory } from './internals/cachedScan.mjs';
import { log } from './internals/logger.mjs';

const argv = await yargs(hideBin(process.argv))
  .command(
    'yarn check <path_copy> <path_source>',
    'detect content of <path_copy> that is missing in <path_source>',
    () => {},
    (argv) => console.info(argv),
  )
  .option('incremental', {
    alias: 'i',
    type: 'boolean',
    description: 'Force to rebuild the cache but incrementally if we already know hashes',
  })
  .option('no-hash', {
    type: 'boolean',
    description: 'Do not use the hash of the files to compare them together',
  })
  .option('no-name', {
    type: 'boolean',
    description: 'Do not use the file name of the files to compare them together',
  })
  .option('no-fail', {
    type: 'boolean',
    description: 'Ignore failures occuring when traversing the tree of files',
  })
  .option('no-create', {
    type: 'boolean',
    description: 'Ignore creation date of the file',
  })
  .option('no-change', {
    type: 'boolean',
    description: 'Ignore last change date of the file',
  })
  .option('no-modify', {
    type: 'boolean',
    description: 'Ignore last modify date of the file',
  })
  .option('no-date', {
    type: 'boolean',
    description: 'Ignore any date related field of the file',
  })
  .demandCommand(2, 2)
  .parse();

const checksumIncludesHash = !argv['no-hash'];
const checksumIncludesName = !argv['no-name'];
const checksumIncludesCreate = !argv['no-date'] || !argv['no-create'];
const checksumIncludesChange = !argv['no-date'] || !argv['no-change'];
const checksumIncludesModify = !argv['no-date'] || !argv['no-modify'];
const isIncremental = !!argv['incremental'];
const continueOnFailure = !argv['no-fail'];
const [copyPath, sourcePath] = argv._;

const sourceContent = new Map(await listFilesRecursively(String(sourcePath)));
const copyContent = new Map(await listFilesRecursively(String(copyPath)));
const logDetails = [
  `with source: ${sourcePath}`,
  `with copy: ${copyPath}`,
  `with hash: ${checksumIncludesHash ? 'ON' : 'OFF'}`,
  `with file: ${checksumIncludesName ? 'ON' : 'OFF'}`,
  `with creation date: ${checksumIncludesCreate ? 'ON' : 'OFF'}`,
  `with change date: ${checksumIncludesChange ? 'ON' : 'OFF'}`,
  `with modify date: ${checksumIncludesModify ? 'ON' : 'OFF'}`,
];

log(`Check if some entries of "copy" are missing in "source"`, logDetails, 'info');

let numMissing = 0;
for (const [checksum, { filePath }] of copyContent) {
  if (!sourceContent.has(checksum)) {
    ++numMissing;
    log(`No such ${JSON.stringify(filePath)} in source`, [], 'warn');
  }
}
if (numMissing !== 0) {
  log(`Found ${numMissing} elements in copy that cannot match anything in source`, logDetails);
} else {
  log(`Every element known in copy is available in source`, logDetails);
}

// Helpers

/**
 * @param {string} dir
 * @returns {Promise<[string, {file:string,filePath:string}][]>}
 */
async function listFilesRecursively(dir) {
  const options = { withHash: checksumIncludesHash, isIncremental, continueOnFailure };
  const results = await cachedScanDirectory(dir, options);
  return results.map((entry) => [
    [
      checksumIncludesHash ? `hash:${entry.hash}` : '',
      checksumIncludesName ? `file:${entry.name}` : '',
      checksumIncludesCreate ? `create:${entry.creationMs}` : '',
      checksumIncludesChange ? `change:${entry.lastChangedMs}` : '',
      checksumIncludesModify ? `modify:${entry.lastModifiedMs}` : '',
    ].join(':'),
    { file: entry.name, filePath: entry.path },
  ]);
}
