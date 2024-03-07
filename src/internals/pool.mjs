// @ts-check
let runningCount = 0;
const maxRunningCount = 100;
const waitingList = [];

/**
 * @returns {void}
 */
function releaseOneInPool() {
  if (waitingList.length === 0) {
    return;
  }
  const [selected] = waitingList.splice(0, 1);
  selected();
}

/**
 * @template TOut
 * @param {() => Promise<TOut>} asyncFn
 * @param {(data: TOut) => void} onDone
 * @param {(error: unknown) => void} onError
 * @returns {void}
 */
function registerInPool(asyncFn, onDone, onError) {
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
  else waitingList.push(action);
}

/**
 * @template TOut
 * @param {() => Promise<TOut>} asyncFn
 * @param {(analytics: {timeInPool:number, timeExecution: number}) => void} onAnalytics
 * @returns {Promise<TOut>}
 */
export function runInPool(asyncFn, onAnalytics) {
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
      onAnalytics({
        timeExecution: endTimeMs - startSelfTimeMs,
        timeInPool: endTimeMs - startPoolTimeMs,
      });
      return data;
    },
    resolve,
    reject,
  );
  return promise;
}

/**
 * @returns {{running: number, pending: number}}
 */
export function poolSize() {
  return { running: runningCount, pending: waitingList.length };
}
