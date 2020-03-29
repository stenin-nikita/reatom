import { SetCounted } from './SetCounted'

export type Leaf = string

export type TreeId = string | symbol

export interface Fn<T = void> {
  (ctx: T): void
  getId(): TreeId
}

export class Tree<TContext = void> {
  id: TreeId

  isLeaf: boolean

  fnsMap: Map<Leaf, SetCounted<Fn<TContext>>>

  constructor(id: TreeId, isLeaf = false) {
    this.id = id
    this.isLeaf = isLeaf
    this.fnsMap = new Map()
  }

  _getFns(key: Leaf) {
    if (!this.fnsMap.has(key)) {
      this.fnsMap.set(key, new SetCounted())
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.fnsMap.get(key)!
  }

  addFn(fn: Fn<TContext>, key: Leaf) {
    this._getFns(key).add(fn)
  }

  union(tree: Tree<TContext>) {
    tree.fnsMap.forEach((set, key) => {
      const fns = this._getFns(key)

      set.forEach(fn => fns.add(fn))
    })
  }

  disunion(tree: Tree<TContext>, cb: (key: TreeId) => void) {
    tree.fnsMap.forEach((set, key) => {
      const fns = this._getFns(key)

      set.forEach(fn => fns.delete(fn) && cb(fn.getId()))
    })
  }

  forEach(key: Leaf, context: TContext) {
    const setCounted = this.fnsMap.get(key)

    if (setCounted) {
      setCounted.forEach(fn => fn(context))
    }
  }
}
