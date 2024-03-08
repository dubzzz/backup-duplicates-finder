/**
 * @param {number} index
 * @returns {number}
 */
function parentIndex(index) {
  return Math.floor((index - 1) / 2);
}

/**
 * @param {number} index
 * @returns {number}
 */
function leftChildIndex(index) {
  return index * 2 + 1;
}

/**
 * @param {number} index
 * @returns {number}
 */
function rightChildIndex(index) {
  return index * 2 + 2;
}

/**
 * @template T
 * @param {T[]} tab
 * @param {number} indexA
 * @param {number} indexB
 * @returns {void}
 */
function swap(tab, indexA, indexB) {
  const temporary = tab[indexA];
  tab[indexA] = tab[indexB];
  tab[indexB] = temporary;
}

/**
 * @template T
 */
export class MaxHeap {
  constructor() {
    this.content = [];
  }

  /**
   * @returns {boolean}
   */
  isEmpty() {
    return this.content.length === 0;
  }

  /**
   * @returns {number}
   */
  size() {
    return this.content.length;
  }

  /**
   * @param {number} weight
   * @param {T} item
   * @returns {void}
   */
  add(weight, item) {
    this.content.push({ weight, item });

    let index = this.content.length - 1;
    while (index > 0 && this.content[parentIndex(index)].weight < this.content[index].weight) {
      const parent = parentIndex(index);
      swap(this.content, parent, index);
      index = parent;
    }
  }

  /**
   * @returns {T}
   */
  peak() {
    if (this.content.length === 0) {
      throw new Error('Cannot peak from an empty heap');
    }

    const { item } = this.content[0];
    this.content[0] = this.content[this.content.length - 1];
    this.content.pop();

    let index = 0;
    while (leftChildIndex(index) < this.content.length) {
      const left = leftChildIndex(index);
      const right = rightChildIndex(index);
      const larger =
        right < this.content.length && this.content[left].weight < this.content[right].weight ? right : left;

      if (this.content[index].weight > this.content[larger].weight) {
        break;
      }
      swap(this.content, index, larger);
      index = larger;
    }

    return item;
  }
}
