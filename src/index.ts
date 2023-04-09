import { escape, unescape } from 'minimatch'
import { Minipass } from 'minipass'
import { Path } from 'path-scurry'
import type {
  GlobOptions,
  GlobOptionsWithFileTypesFalse,
  GlobOptionsWithFileTypesTrue,
  GlobOptionsWithFileTypesUnset,
} from './glob.js'
import { Glob } from './glob.js'
import { hasMagic } from './has-magic.js'

/**
 * Syncronous form of {@link globStream}. Will read all the matches as fast as
 * you consume them, even all in a single tick if you consume them immediately,
 * but will still respond to backpressure if they're not consumed immediately.
 */
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Minipass<Path, Path>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Minipass<string, string>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesUnset
): Minipass<string, string>
export function globStreamSync(
  pattern: string | string[],
  options: GlobOptions
): Minipass<Path, Path> | Minipass<string, string>
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
): Minipass<string, string>
export function globStream(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Minipass<Path, Path>
export function globStream(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Minipass<string, string>
export function globStream(
  pattern: string | string[],
  options: GlobOptions
): Minipass<Path, Path> | Minipass<string, string>
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
): string[]
export function globSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Path[]
export function globSync(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): string[]
export function globSync(
  pattern: string | string[],
  options: GlobOptions
): Path[] | string[]
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
async function glob_(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Promise<string[]>
async function glob_(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Promise<Path[]>
async function glob_(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Promise<string[]>
async function glob_(
  pattern: string | string[],
  options: GlobOptions
): Promise<Path[] | string[]>
async function glob_(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).walk()
}

/**
 * Return a sync iterator for walking glob pattern matches.
 */
export function globIterateSync(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): Generator<string, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): Generator<Path, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): Generator<string, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptions
): Generator<Path, void, void> | Generator<string, void, void>
export function globIterateSync(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).iterateSync()
}

/**
 * Return an async iterator for walking glob pattern matches.
 */
export function globIterate(
  pattern: string | string[],
  options?: GlobOptionsWithFileTypesUnset | undefined
): AsyncGenerator<string, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesTrue
): AsyncGenerator<Path, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptionsWithFileTypesFalse
): AsyncGenerator<string, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptions
): AsyncGenerator<Path, void, void> | AsyncGenerator<string, void, void>
export function globIterate(
  pattern: string | string[],
  options: GlobOptions = {}
) {
  return new Glob(pattern, options).iterate()
}

// aliases: glob.sync.stream() glob.stream.sync() glob.sync() etc
export const streamSync = globStreamSync
export const stream = Object.assign(globStream, { sync: globStreamSync })
export const iterateSync = globIterateSync
export const iterate = Object.assign(globIterate, {
  sync: globIterateSync,
})
export const sync = Object.assign(globSync, {
  stream: globStreamSync,
  iterate: globIterateSync,
})

/* c8 ignore start */
export { escape, unescape } from 'minimatch'
export { Glob } from './glob.js'
export type {
  GlobOptions,
  GlobOptionsWithFileTypesFalse,
  GlobOptionsWithFileTypesTrue,
  GlobOptionsWithFileTypesUnset,
} from './glob.js'
export { hasMagic } from './has-magic.js'
export type { IgnoreLike } from './ignore.js'
export type { MatchStream } from './walker.js'
/* c8 ignore stop */

export const glob = Object.assign(glob_, {
  glob: glob_,
  globSync,
  sync,
  globStream,
  stream,
  globStreamSync,
  streamSync,
  globIterate,
  iterate,
  globIterateSync,
  iterateSync,
  Glob,
  hasMagic,
  escape,
  unescape,
})
glob.glob = glob
