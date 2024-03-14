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
 * @returns {Promise<{name: string, path:string, hash:string|undefined, lastChangedMs:number, lastModifiedMs:number}[]>}
 */
export async function cachedScanDirectory(dir, options) {
  const cachedResultsDirectoryPath = path.join(__dirname, '..', '..', '.cache');
  const cachedResultsPath = path.join(
    cachedResultsDirectoryPath,
    path.basename(dir) + '-' + createHash('sha1').update(dir).digest('hex') + '-' + options.withHash + '.json',
  );
  const printedOptions = JSON.stringify(options);

  let cachedResults = undefined;
  try {
    const cachedResultsRaw = await fs.readFile(cachedResultsPath);
    cachedResults = JSON.parse(cachedResultsRaw.toString());
    log(
      `Cache found for ${dir} with options ${printedOptions}`,
      [`read from ${cachedResultsPath}`, `got ${cachedResults.length} results`],
      'info',
    );
    if (!options.isIncremental) {
      return cachedResults;
    }
  } catch (err) {
    if (options.isIncremental && options.withHash) {
      const normalizedDir = path.normalize(dir);
      const { appendLine } = log(
        `Aggregating data from already known directories for a faster incremental scan`,
        [],
        'info',
      );
      cachedResults = [];
      const files = await fs.readdir(cachedResultsDirectoryPath, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const fileFullPath = path.join(file.path, file.name);
          appendLine(`Reading from ${fileFullPath}`);
          const fileContentRaw = await fs.readFile(fileFullPath);
          const fileContent = JSON.parse(fileContentRaw.toString());

          let addedOne = false;
          for (const item of fileContent) {
            if (typeof item.hash === 'string' && path.normalize(item.path).includes(normalizedDir)) {
              addedOne = true;
              cachedResults.push(item);
            }
          }
          if (addedOne) {
            appendLine(`Total items count: ${cachedResults.length}`);
          }
        }
      }
    }
  }
  const knownFilePathToHash =
    cachedResults !== undefined ? new Map(cachedResults.map((r) => [r.path, r.hash])) : undefined;

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
