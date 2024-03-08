import { MaxHeap } from './maxHeap.mjs';

// @ts-check
let runningCount = 0;
const maxRunningCount = 100;
const waitingList = new MaxHeap();

/**
 * @returns {void}
 */
function releaseOneInPool() {
  if (waitingList.isEmpty()) {
    return;
  }
  const action = waitingList.peak();
  action();
}

/**
 * @template TOut
 * @param {() => Promise<TOut>} asyncFn
 * @param {number} weight
 * @param {(data: TOut) => void} onDone
 * @param {(error: unknown) => void} onError
 * @returns {void}
 */
function registerInPool(asyncFn, weight, onDone, onError) {
  const action = () => {
    ++runningCount;
    asyncFn().then(
      (data) => {
        --runningCount;
        releaseOneInPool();
        onDone(data);
      },
      (error) => {
        --runningCount;
        releaseOneInPool();
        onError(error);
      },
    );
  };
  if (runningCount < maxRunningCount) action();
  else waitingList.add(weight, action);
}

/**
 * @template TOut
 * @param {() => Promise<TOut>} asyncFn
 * @param {number} weight
 * @param {(analytics: {timeInPool:number, timeExecution: number, weight:number, ratioWaiting: number}) => void} onAnalytics
 * @returns {Promise<TOut>}
 */
export function runInPool(asyncFn, weight, onAnalytics) {
  const startPoolTimeMs = performance.now();
  let resolve, reject;
  const promise = new Promise((r, rej) => {
    resolve = r;
    reject = rej;
  });
  registerInPool(
    async () => {
      const startSelfTimeMs = performance.now();
      const data = await asyncFn();
      const endTimeMs = performance.now();
      const timeExecution = endTimeMs - startSelfTimeMs;
      const timeInPool = endTimeMs - startPoolTimeMs;
      const ratioWaiting = (timeInPool - timeExecution) / timeInPool;
      onAnalytics({ timeExecution, timeInPool, ratioWaiting, weight });
      return data;
    },
    weight,
    resolve,
    reject,
  );
  return promise;
}

/**
 * @returns {{running: number, pending: number}}
 */
export function poolSize() {
  return { running: runningCount, pending: waitingList.size() };
}
