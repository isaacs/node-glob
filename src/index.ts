import {
  Glob,
  GlobOptions,
  GlobOptionsWithFileTypesFalse,
  GlobOptionsWithFileTypesTrue,
  GlobOptionsWithFileTypesUnset,
  Results,
} from './glob.js'
import { hasMagic } from './has-magic.js'
import {
  GWOFileTypesFalse,
  GWOFileTypesTrue,
  GWOFileTypesUnset,
  MatchStream,
} from './walker.js'

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

/* c8 ignore start */
export { Glob } from './glob.js'
export type { GlobOptions } from './glob.js'
export { hasMagic } from './has-magic.js'
/* c8 ignore stop */
export default Object.assign(glob, {
  glob: glob,
  sync: globSync,
  globSync,
  stream: globStream,
  streamSync: globStreamSync,
  globStream,
  globStreamSync,
  Glob,
  hasMagic,
})
