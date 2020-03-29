export class SetCounted<T = any> {
  private _counter = new Map<T, number>()

  add(item: T) {
    this._counter.set(item, (this._counter.get(item) || 0) + 1)
  }

  delete(item: T) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const count = this._counter.get(item)!

    if (count === 1) {
      return this._counter.delete(item)
    }

    if (count > 1) {
      this._counter.set(item, count - 1)
    }

    return false
  }

  forEach(cb: (item: T) => any) {
    this._counter.forEach((_, item) => cb(item))
  }
}
