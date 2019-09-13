import { Tree, State, TreeId, Ctx, createCtx } from './kernel'
import {
  TREE,
  nameToId,
  Unit,
  throwError,
  getTree,
  safetyFunc,
  getIsAction,
  assign,
} from './shared'
import {
  Action,
  declareAction,
  ActionType,
  ActionCreator,
} from './declareAction'

const DEPS = Symbol('@@Reatom/DEPS')

// action for set initialState of each atom to global state
const _initAction = declareAction(['@@ReAtom/init'])
export const initAction = _initAction()

export type Atom<T> = {
  (state?: State, action?: Action<any>): State
  [TREE]: Tree
  [DEPS]: TreeId[]
}

type Lens<T, El> = {
  get: (state: T, key: string | number) => El
  set: (state: T, key: string | number, value: El) => T
}

const lensDefault: Lens<any[] | Record<any, any>, any> = {
  // @ts-ignore
  get: (state, key) => state[key],
  set: (state, key, value) => (
    (state = Array.isArray(state) ? state.slice(0) : assign({}, state)),
    (state[key] = value),
    state
  ),
}

function identity<T>(a: T, ..._a: any[]): T {
  return a
}

// @ts-ignore
export declare function declareAtom<State>(
  name: string | [TreeId],
  initialState: State,
  dependencyMatcher: (
    on: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State,
    ) => void,
    lens: <T, El>(
      dependency: ActionCreator<T>,
      reducer: (value: El, payload: T) => El,
      lenses?: Lens<State, El>,
    ) => void,
  ) => any,
): Atom<State>
// @ts-ignore
export declare function declareAtom<State>(
  initialState: State,
  dependencyMatcher: (
    on: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State,
    ) => void,
    lens: <T, El>(
      dependency: ActionCreator<T>,
      reducer: (value: El, payload: T) => El,
      lenses?: Lens<State, El>,
    ) => void,
  ) => any,
): Atom<State>
export function declareAtom<State>(
  name: string | [TreeId],
  initialState: State,
  dependencyMatcher: (
    on: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State | undefined,
    ) => void,
  ) => any,
): Atom<State> {
  if (arguments.length === 2) {
    // @ts-ignore
    dependencyMatcher = initialState
    // @ts-ignore
    initialState = name
    name = 'atom'
  }

  const _id = nameToId(name)

  const _tree = new Tree(_id)
  const _deps = new Set<TreeId>()
  // start from `0` for missing `actionDefault`
  let dependencePosition = 0
  let initialPhase = true

  if (initialState === undefined)
    throwError(`Atom "${_id}". Initial state can't be undefined`)

  function on<T>(
    dep: Unit<T>,
    reducer: (state: State, payload: T) => State | undefined,
    lens?: Lens<State, unknown>,
  ) {
    if (!initialPhase)
      throwError("Can't define dependencies after atom initialization")

    const position = dependencePosition++
    const depTree = getTree(dep as any)!
    if (!depTree) throwError('Invalid dependency')
    const depId = depTree.id
    safetyFunc(reducer, 'reducer')

    const isDepActionCreator = getIsAction(dep)
    const isLens = Boolean(lens)

    _tree.union(depTree)

    let get = identity
    let set = identity
    if (isLens) {
      if (!isDepActionCreator)
        throwError("Can't depends from atoms in lens, use declared action")
      // @ts-ignore
      get = lens.get
      // @ts-ignore
      set = lens.set
    }

    if (isDepActionCreator) _tree.addFn(update, depId)
    else {
      ;(dep as Atom<any>)[DEPS].forEach(treeId => _deps.add(treeId))
      if (_deps.has(depId)) throwError('One of dependencies has the equal id')
      _deps.add(depId)
      depTree.fnsMap.forEach((_, key) => _tree.addFn(update, key))
    }

    function update({ state, stateNew, payload, changedIds, type, key }: Ctx) {
      const atomStateSnapshot = state[_id]
      // first `walk` of lazy (dynamically added by subscription) atom
      const isAtomLazy = atomStateSnapshot === undefined

      if (!isAtomLazy && type === initAction.type) return

      const atomStatePreviousReducer = stateNew[_id]
      // it is mean atom has more than one dependencies
      // that depended from dispatched action
      // and one of the atom reducers already processed
      const hasAtomNewState = atomStatePreviousReducer !== undefined
      const atomState = hasAtomNewState
        ? atomStatePreviousReducer
        : atomStateSnapshot

      const depStateSnapshot = state[depId]
      const depStateNew = stateNew[depId]
      const isDepChanged = depStateNew !== undefined
      const depState = isDepChanged ? depStateNew : depStateSnapshot
      const depValue = isDepActionCreator ? payload : depState

      if (isDepActionCreator || isDepChanged || isAtomLazy) {
        let isAtomStateLensedChange = false
        let atomStateLensedNew
        let atomStateNew

        if (isLens) {
          const atomStateLensed = get(atomState, key)
          atomStateLensedNew = reducer(atomStateLensed, depValue)
          isAtomStateLensedChange = atomStateLensed !== atomStateLensedNew
          atomStateNew = set(atomState, key, atomStateLensedNew)
        } else {
          atomStateNew = reducer(atomState, depValue)
        }

        if (atomStateNew === undefined)
          throwError(
            `Invalid state. Reducer № ${position} in "${_id}" atom returns undefined`,
          )

        if (atomStateNew !== atomState) {
          stateNew[_id] = atomStateNew
          if (!hasAtomNewState) changedIds.push(_id)
          if (isLens && isAtomStateLensedChange) {
            const id = _id + key
            stateNew[id] = atomStateLensedNew
            changedIds.push(id)
          }
        }
      }
    }
  }

  on(_initAction, (state = initialState) => state)

  dependencyMatcher(
    // @ts-ignore
    (dependency, reducer) => on(dependency, reducer),
    // @ts-ignore
    (dependency, reducer, lens = lensDefault) => on(dependency, reducer, lens),
  )

  function atom(
    state: Ctx['state'] = {},
    action: { type: ActionType; payload: any } = initAction,
  ) {
    const ctx = createCtx(state, action)
    _tree.forEach(action.type, ctx)

    const { changedIds, stateNew } = ctx

    return changedIds.length > 0 ? assign({}, state, stateNew) : state
  }

  // @ts-ignore
  atom[TREE] = _tree
  // @ts-ignore
  atom[DEPS] = _deps

  // @ts-ignore
  return atom
}

export function getState<T>(state: State, atom: Atom<T>): T | undefined {
  return state[atom[TREE].id]
}

// @ts-ignore
export declare function map<T, _T = unknown>(
  atom: Atom<_T>,
  mapper: (dependedAtomState: _T) => T,
): Atom<T>
// @ts-ignore
export declare function map<T, _T = unknown>(
  name: string | [TreeId],
  atom: Atom<_T>,
  mapper: (dependedAtomState: _T) => T,
): Atom<T>
// @ts-ignore
export function map(name, target, mapper) {
  if (arguments.length === 2) {
    mapper = target
    target = name
    // @ts-ignore
    name = getTree(target).id + ' [map]'
  }
  safetyFunc(mapper, 'mapper')

  return declareAtom(
    name,
    // FIXME: initialState for `map` :thinking:
    null,
    on => on(target, (state, payload) => mapper(payload)),
  )
}

// @ts-ignore
export declare function combine<
  T extends { [key in string]: Atom<any> } | TupleOfAtoms
>(
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
// @ts-ignore
export declare function combine<
  T extends { [key in string]: Atom<any> } | TupleOfAtoms
>(
  name: string | [TreeId],
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
export function combine(name: any, shape: any) {
  let keys: string[]
  if (arguments.length === 1) {
    // @ts-ignore
    shape = name
    name = '{' + (keys = Object.keys(shape)).join() + '}'
  }

  keys = keys! || Object.keys(shape)

  const isArray = Array.isArray(shape)

  return declareAtom(name, isArray ? [] : {}, reduce =>
    keys.map(key =>
      reduce(shape[key], (state, payload) => {
        const newState: any = isArray
          ? (state as any[]).slice(0)
          : assign({}, state)
        newState[key] = payload
        return newState
      }),
    ),
  )
}

// prettier-ignore
type TupleOfAtoms =
  [Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>] 
| [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
