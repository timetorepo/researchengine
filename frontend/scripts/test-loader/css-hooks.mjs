// Test-only module hook: a CSS import loads as an empty module, so suites that
// mount components with their stylesheets run under Node + tsx. The browser
// build still applies the real CSS through Vite.
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {}', shortCircuit: true }
  }
  return nextLoad(url, context)
}
