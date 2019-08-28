import { performance } from 'perf_hooks'

const samplePerc = 0.95
const samples = 10
const iterations = 1000

interface Options {
  before?: () => any,
  after?: (payload: any) => void
}

type TestFunc = (payload: any) => void
type Measurements = number[]

const getMax = (numArray: number[]) => Math.max.apply(null, numArray)
const getMin = (numArray: number[]) => Math.min.apply(null, numArray)

export const bench = (id: string, fn: TestFunc, opts?: Options) => {
  const measurements: Measurements = []
  const errors: number[] = []

  for (let i = 0; i < samples; i++) {
    const { mid, error } = sample(fn, opts);
    errors.push(error)
    measurements.push(mid)
  }

  const { min, max, mid, error } = calc(measurements)

  // console.log(measunres[id])
  // const midError = errors.reduce((acc, curr) => acc + curr, 0) / errors.length

  const opSec = 1000 / mid

  console.log(id, `${mid.toFixed(3)}ms`)
  // console.log(id, `${mid.toFixed(3)}ms`, `± ${error.toFixed(2)}%`)
  // console.log(id, `${opSec.toFixed(0)} ops/sec`)
  // console.log(id, `× ${opSec.toFixed(0)} ops/sec`, `± ${error.toFixed(2)}%`)
}

const sample = (fn: TestFunc, opts?: Options) => {
  const measurements: Measurements = []

  const options = {
    before: () => {},
    after: () => {},
    ...opts
  }

  for (let i = 0; i < iterations; i++) {
    const payload = options.before()
    const start = performance.now()
    fn(payload)
    measurements.push(performance.now() - start)
    options.after(payload)
  }

  return calc(measurements)
}

const calc = (measurements: number[]): { mid: number, max: number, min: number, error: number } => {
  const trimSize = Math.round(measurements.length * (1 - samplePerc))
  const filtered = measurements.slice(trimSize / 2 - 1, measurements.length - trimSize)

  const min = getMin(filtered);
  const max = getMax(filtered);
  const mid = filtered.reduce((acc, curr) => acc + curr, 0) / filtered.length
  const error = getMax([mid - min, max - mid]) / mid * 100

  return { mid, max, min, error }
}