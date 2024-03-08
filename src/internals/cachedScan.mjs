// @ts-check
import fs from 'fs/promises';
import path from 'path';
import * as url from 'url';
import { createHash } from 'crypto';
import { scanDirectory } from './scan.mjs';
import { log } from './logger.mjs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @param {string} dir
 * @param {{withHash: boolean, isIncremental:boolean,continueOnFailure:boolean}} options
 * @returns {Promise<{name: string, path:string, hash:string|undefined}[]>}
 */
export async function cachedScanDirectory(dir, options) {
  const cachedResultsPath = path.join(
    __dirname,
    '..',
    '..',
    '.cache',
    path.basename(dir) + '-' + createHash('sha1').update(dir).digest('hex') + '-' + options.withHash + '.json',
  );
  const printedOptions = JSON.stringify(options);

  let knownFilePathToHash = undefined;
  try {
    const cachedResultsRaw = await fs.readFile(cachedResultsPath);
    const cachedResults = JSON.parse(cachedResultsRaw.toString());
    log(
      `Cache found for ${dir} with options ${printedOptions}`,
      [`read from ${cachedResultsPath}`, `got ${cachedResults.length} results`],
      'info',
    );
    if (!options.isIncremental) {
      return cachedResults;
    }
    knownFilePathToHash = new Map(cachedResults.map((r) => [r.path, r.hash]));
  } catch (err) {}

  const { appendLine } =
    knownFilePathToHash === undefined
      ? log(`No cache found for ${dir} with options ${printedOptions}`, [], 'warn')
      : log(`Incrementally computing cache for ${dir} with options ${printedOptions}`, [], 'warn');
  const results = await scanDirectory(dir, knownFilePathToHash, options);
  appendLine(`scan found ${results.length} results`);
  await fs.mkdir(path.dirname(cachedResultsPath), { recursive: true });
  await fs.writeFile(cachedResultsPath, JSON.stringify(results));
  appendLine(`wrote cache to ${cachedResultsPath}`);
  return results;
}
