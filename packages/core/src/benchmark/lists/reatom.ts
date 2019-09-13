import * as reatom from '../../../build'

const { declareAtom, declareAction, createStore, map, combine } = reatom

export type Addresses = {
  ids: string[]
  cities: Record<string, string>
  streets: Record<string, string>
  houses: Record<string, number>
}

export const fetchAddressesDone = declareAction<Addresses>()
// export const changeCite = declareAction...
// export const changeStreet = declareAction...
export const changeHouse = declareAction<{
  id: string
  value: number
}>()
export const changeInput = declareAction<string>()

export const AddressesIdsList = declareAtom<Addresses['ids']>([], on => [
  on(fetchAddressesDone, (state, { ids }) => ids),
])
export const Cities = declareAtom<Addresses['cities']>({}, on => [
  on(fetchAddressesDone, (state, { cities }) => cities),
])
export const Streets = declareAtom<Addresses['streets']>({}, on => [
  on(fetchAddressesDone, (state, { streets }) => streets),
])
export const Houses = declareAtom<Addresses['houses']>({}, (on, lens) => [
  on(fetchAddressesDone, (state, { houses }) => houses),
  lens(changeHouse, (state, { id, value }) => value),
])
export const Input = declareAtom('', on => [
  on(changeInput, (state, input) => input),
])

const Root = combine([AddressesIdsList, Cities, Streets, Houses, Input])

export const initializeStore = () => createStore(Root)
