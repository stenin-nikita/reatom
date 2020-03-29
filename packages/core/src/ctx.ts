import { TreeId, Leaf, Tree as BaseTree } from './kernel'

export { Fn, Leaf, TreeId } from './kernel'

export type State = Record<TreeId, unknown>

export type BaseAction<T = any> = { type: Leaf; payload: T }

export function createCtx(state: State, { type, payload }: BaseAction) {
  return {
    state,
    stateNew: {} as State,
    type,
    payload,
    changedIds: [] as TreeId[],
  }
}

export type Ctx = ReturnType<typeof createCtx>

export class Tree extends BaseTree<Ctx> {}
