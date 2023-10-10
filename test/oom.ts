import t from 'tap'
import { Glob } from '../'

const pattern =
  '@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:100;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:200;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:300;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:400;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:500;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:600;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:700;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:800;src:url(*) format("woff2"),url(*) format("woff")}@font-face{font-display:var(--fontsource-display,swap);font-family:Poppins;font-style:normal;font-weight:900;src:url(*) format("woff2"),url(*) format("woff")}'
process.chdir(__dirname + '/..')

t.test('does not oom on long glob', async t => {
  var g = new Glob(pattern, {})
  const results = await g.walk()

  t.equal(
    results.length,
    0,
    'must match all files'
  )
})

