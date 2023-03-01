import { escape, unescape } from 'minimatch'
import type {
  GlobOptions,
  GlobOptionsWithFileTypesFalse,
  GlobOptionsWithFileTypesTrue,
  GlobOptionsWithFileTypesUnset,
  Results,
} from './glob.js'
import { Glob } from './glob.js'
import { hasMagic } from './has-magic.js'
import type {
  GWOFileTypesFalse,
  GWOFileTypesTrue,
  GWOFileTypesUnset,
  MatchStream,
  Result,
} from './walker.js'

/**
 * Syncronous form of {@link globStream}. Will read all the matches as fast as
 * you consume them, even all in a single tick if you consume them immediately,
 * but will still respond to backpressure if they're not consumed immediately.
 */
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): MatchStream<GWOFileTypesTrue>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): MatchStream<GWOFileTypesFalse>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesUnset
): MatchStream<GWOFileTypesUnset>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptions
): MatchStream<GlobOptions>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).streamSync()
}

/**
 * Return a stream that emits all the strings or `Path` objects and
 * then emits `end` when completed.
 */
export function globStream(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): MatchStream<GWOFileTypesFalse>
export function globStream(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): MatchStream<GWOFileTypesTrue>
export function globStream(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): MatchStream<GWOFileTypesUnset>
export function globStream(
  pattern: string | string[],
  options: GlobOptions
): MatchStream<GlobOptions>
export function globStream(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).stream()
}

/**
 * Synchronous form of {@link glob}
 */
export function globSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Results<GWOFileTypesFalse>
export function globSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Results<GWOFileTypesTrue>
export function globSync(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Results<GWOFileTypesUnset>
export function globSync(
  pattern: string | string[],
  options: GlobOptions
): Results<GlobOptions>
export function globSync(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).walkSync()
}

/**
 * Perform an asynchronous glob search for the pattern(s) specified. Returns
 * [Path](https://isaacs.github.io/path-scurry/classes/PathBase) objects if the
 * {@link withFileTypes} option is set to `true`. See {@link GlobOptions} for
 * full option descriptions.
 */
export async function glob(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Promise<Results<GWOFileTypesUnset>>
export async function glob(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Promise<Results<GWOFileTypesTrue>>
export async function glob(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Promise<Results<GWOFileTypesFalse>>
export async function glob(
  pattern: string | string[],
  options: GlobOptions
): Promise<Results<GlobOptions>>
export async function glob(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).walk()
}

/**
 * Return an async iterator for walking glob pattern matches.
 */
export function globIterate(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): AsyncGenerator<Result<GWOFileTypesUnset>, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): AsyncGenerator<Result<GWOFileTypesTrue>, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): AsyncGenerator<Result<GWOFileTypesFalse>, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptions
): AsyncGenerator<Result<GlobOptions>, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).iterate()
}

/**
 * Return a sync iterator for walking glob pattern matches.
 */
export function globIterateSync(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Generator<Result<GWOFileTypesUnset>, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Generator<Result<GWOFileTypesTrue>, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Generator<Result<GWOFileTypesFalse>, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptions
): Generator<Result<GlobOptions>, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).iterateSync()
}

/* c8 ignore start */
export { escape, unescape } from 'minimatch'
export { Glob } from './glob.js'
export type {
  GlobOptions,
  GlobOptionsWithFileTypesFalse,
  GlobOptionsWithFileTypesTrue,
  GlobOptionsWithFileTypesUnset,
  Result,
  Results,
} from './glob.js'
export { hasMagic } from './has-magic.js'
export type { MatchStream } from './walker.js'

/* c8 ignore stop */
export default Object.assign(glob, {
  glob,
  globSync,
  globStream,
  globStreamSync,
  globIterate,
  globIterateSync,
  Glob,
  hasMagic,
  escape,
  unescape,
})
