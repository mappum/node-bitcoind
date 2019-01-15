# bitcoind

Run a Bitcoin Core full node from Node.js.

On install, this package downloads a prebuilt binary from the [official Bitcoin Core release torrent](https://bitcoin.org/en/download) via [WebTorrent](https://github.com/webtorrent/webtorrent), and checks it against a known SHA256 hash.

## Usage
`npm install bitcoind`

```js
let bitcoind = require('bitcoind')

// start the full node
let node = bitcoind({
  // options are turned into CLI args
  testnet: true,
  rpcport: 12345
})

// returns handle to child process
node.stdout.pipe(process.stdout)

// comes with initialized rpc client
node.rpc.getNetworkInfo().then(console.log)
```

### `bitcoind(opts)`

Spawns a Bitcoin Core full node.

Returns a `ChildProcess` object representing the `bitcoind` process. It has an `rpc` property which is a client for the node's RPC server (from the [bitcoin-core](https://github.com/ruimarinho/bitcoin-core) package).

`opts` may be an object containing options passed to bitcoind as CLI arguments (you may use any flag supported by bitcoind). To see all supported options, run `npx bitcoind --help`.

### CLI

Installing the package also exposes a `bitcoind` command, so you can use this as an easy way to install bitcoin:
```
$ npm i -g bitcoind
$ bitcoind -version
```
