// coverts arbitrary options into CLI args
// { foo: 123, barbaz: true } => [ '-foo=123', '-barbaz=1' ]
module.exports = function (opts = {}) {
  let args = []
  for (let [ key, value ] of Object.entries(opts)) {
    if (key.toLowerCase() !== key) {
      throw Error('Options must be lowercase')
    }

    if (value === true) {
      value = 1
    } else if (value === false) {
      value = 0
    }

    let arg = `-${key}=${value.toString()}`
    args.push(arg)
  }
  return args
}
