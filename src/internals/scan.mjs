// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { poolSize, runInPool } from './pool.mjs';
import { log } from './logger.mjs';

/**
 * @param {string} dir
 * @param {Map<string, string|undefined>|undefined} knownFilePathToHash
 * @param {{withHash: boolean, continueOnFailure:boolean}} options
 * @returns {Promise<{name: string, path:string, hash:string|undefined}[]>}
 */
export async function scanDirectory(dir, knownFilePathToHash, options) {
  const fileList = [];
  await scanDirectoryInternal(
    dir,
    options.withHash,
    options.continueOnFailure,
    fileList,
    knownFilePathToHash ?? new Map(),
  ).catch((err) => {
    log('Scan directory aborted', [['error:', err]], 'error');
    throw new Error(`Scan directory aborted`, { cause: err });
  });
  return fileList;
}

/**
 * @param {string} dir
 * @param {boolean} withHash
 * @param {boolean} continueOnFailure
 * @param {{name: string, path:string, hash:string|undefined}[]} fileList
 * @param {Map<string, string|undefined>} knownFilePathToHash
 * @returns {Promise<void>}
 */
async function scanDirectoryInternal(dir, withHash, continueOnFailure, fileList, knownFilePathToHash) {
  const files = await fs.readdir(dir);

  let resolveDirectoryDone, rejectDirectoryDone;
  const directoryDonePromise = new Promise((r, rej) => {
    resolveDirectoryDone = r;
    rejectDirectoryDone = rej;
  });

  let missing = 0;
  const onSuccess = () => {
    if (--missing === 0) resolveDirectoryDone();
  };
  for (const file of files) {
    ++missing;
    scanAnyInternal(dir, file, withHash, continueOnFailure, fileList, knownFilePathToHash).then(
      onSuccess,
      continueOnFailure ? onSuccess : rejectDirectoryDone,
    );
  }
  if (missing === 0) {
    resolveDirectoryDone();
  }
  return directoryDonePromise;
}

/**
 * @param {string} dir
 * @param {string} file
 * @param {boolean} withHash
 * @param {boolean} continueOnFailure
 * @param {{name: string, path:string, hash:string|undefined}[]} fileList
 * @param {Map<string, string|undefined>} knownFilePathToHash
 * @returns {Promise<void>}
 */
async function scanAnyInternal(dir, file, withHash, continueOnFailure, fileList, knownFilePathToHash) {
  const filePath = path.join(dir, file);
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    await scanDirectoryInternal(filePath, withHash, continueOnFailure, fileList, knownFilePathToHash);
  } else if (!withHash) {
    fileList.push({ name: file, path: filePath, hash: undefined });
  } else if (stats.isFile()) {
    const alreadyHash = knownFilePathToHash.get(filePath);
    if (alreadyHash !== undefined) {
      fileList.push({ name: file, path: filePath, hash: alreadyHash });
    } else {
      let analytics;
      const sha1sum = await withRetries(
        () =>
          runInPool(
            () =>
              computeHash(filePath).catch((err) => {
                throw new Error(`Failed to compute the hash of ${filePath}`, { cause: err });
              }),
            stats.size,
            (a) => (analytics = a),
          ),
        5,
      );
      log(
        `Scanned: ${file}`,
        [`analytics: ${JSON.stringify(analytics)}`, `hash: ${sha1sum}`, `pool: ${JSON.stringify(poolSize())}`],
        'debug',
      );
      fileList.push({ name: file, path: filePath, hash: sha1sum });
    }
  } else {
    log('Skipped non directory or file element', [`got: ${filePath}`], 'info');
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function computeHash(filePath) {
  const hashComputation = createHash('sha1');
  const fd = await fs.open(filePath);
  const readStream = fd.createReadStream();

  let resolve, reject;
  const promise = new Promise((r, rej) => {
    resolve = r;
    reject = rej;
  });
  readStream.on('data', (data) => hashComputation.update(data));
  readStream.on('error', (err) => {
    try {
      fd.close();
    } finally {
      reject(err);
    }
  });
  readStream.on('end', () => {
    try {
      fd.close();
    } finally {
      resolve(hashComputation.digest('hex'));
    }
  });

  return promise;
}

/**
 * @template T
 * @param {() => Promise<T>} action
 * @param {number} count
 * @returns {Promise<T>}
 */
async function withRetries(action, count) {
  const errors = [];
  for (let i = 0; i < count; ++i) {
    try {
      const out = await action();
      return out;
    } catch (err) {
      log(
        `Action failed to execute properly, ${i + 1 === count ? 'canceled' : 'might re-execute itself later'}`,
        [`number of attempts: ${i + 1}`, `max number of attempts: ${count}`, [`error:`, err]],
        'warn',
      );
      errors.push(err);
    }
  }
  throw new AggregateError(errors, `Failed after ${count} retries`);
}
