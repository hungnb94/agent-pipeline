// Jest module shim: chalk@5+ is pure ESM and breaks ts-jest (CJS).
// Identity shim — pipeline tests don't care about color output, only behavior.
// All chalk.X(...) calls return the input string unchanged.
const handler = {
  get: (_target, prop) => {
    if (prop === 'default' || prop === '__esModule' || typeof prop === 'symbol') {
      return undefined;
    }
    // Any color/bold/etc. accessor returns a function that returns its first arg.
    return (s) => (typeof s === 'string' ? s : String(s));
  },
  apply: () => '',
};
const proxy = new Proxy(function () {}, handler);
module.exports = proxy;
module.exports.default = proxy;
