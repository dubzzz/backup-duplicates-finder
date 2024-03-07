// @ts-check
let runningCount = 0;
const maxRunningCount = 100;
const waitingList = []; // switch to a max-heap

/**
 * @returns {void}
 */
function releaseOneInPool() {
  if (waitingList.length === 0) {
    return;
  }
  let indexMax = 0;
  for (let i = 1; i !== waitingList.length; ++i) {
    if (waitingList[i].weight > waitingList[indexMax].weight) {
      indexMax = i;
    }
  }
  const [selected] = waitingList.splice(indexMax, 1);
  selected.action();
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
  else waitingList.push({ weight, action });
}

/**
 * @template TOut
 * @param {() => Promise<TOut>} asyncFn
 * @param {number} weight
 * @param {(analytics: {timeInPool:number, timeExecution: number}) => void} onAnalytics
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
      onAnalytics({
        timeExecution: endTimeMs - startSelfTimeMs,
        timeInPool: endTimeMs - startPoolTimeMs,
      });
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
  return { running: runningCount, pending: waitingList.length };
}
