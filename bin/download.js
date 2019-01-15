#!/usr/bin/env node

const { createHash } = require('crypto')
const {
  createWriteStream,
  readFileSync,
  renameSync,
  accessSync,
  copyFileSync
} = require('fs')
const { createGunzip } = require('zlib')
const { homedir } = require('os')
const { join, dirname } = require('path')
const ProgressBar = require('progress')
const mkdirp = require('mkdirp').sync
const tar = require('tar')
const rimraf = require('rimraf').sync
const WebTorrent = require('webtorrent')

let versionPath = join(__dirname, 'version')
let bitcoindVersion = readFileSync(versionPath, 'utf8').trim()

let cacheBinPath = join(
  homedir(),
  '.node-bitcoind',
  `bitcoind_${bitcoindVersion}`
)
let binPath = join(__dirname, 'bitcoind')
try {
  accessSync(cacheBinPath)
  // binary was already downloaded
  copyFileSync(cacheBinPath, binPath)
  process.exit(0)
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}

console.log(`downloading Bitcoin Core v${bitcoindVersion}`)
let archiveFilename = getArchiveFilename(bitcoindVersion)
let torrentPath = join(__dirname, 'bitcoin.torrent')

let torrentClient = new WebTorrent()
torrentClient.add(torrentPath, function (torrent) {
  // see https://github.com/webtorrent/webtorrent/issues/164#issuecomment-248395202
  torrent.deselect(0, torrent.pieces.length - 1, false)

  let archiveFile
  for (let file of torrent.files) {
    if (file.name === archiveFilename) {
      file.select()
      archiveFile = file
    } else {
      file.deselect()
    }
  }

  let template = '[:bar] :rate/Mbps :percent :etas'
  let bar = new ProgressBar(template, {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: archiveFile.length / 1e6 * 8
  })

  let extractPath = join(__dirname, `bitcoin-${bitcoindVersion}`)
  let tempBinPath = join(extractPath, 'bin/bitcoind')
  let shasumPath = join(__dirname, 'SHA256SUMS.asc')

  let stream = archiveFile.createReadStream()

  stream
    .pipe(createGunzip())
    .pipe(tar.extract({
      cwd: __dirname,
      filter (path, entry) {
        return path === `bitcoin-${bitcoindVersion}/bin/bitcoind`
      }
    }))
  // TODO: windows unzip

  // verify hash of file
  // Since the SHA256SUMS file comes from npm, and the binary
  // comes from GitHub, both npm AND GitHub would need to be
  // compromised for the binary download to be compromised.
  let hasher = createHash('sha256')
  stream.on('data', (chunk) => hasher.update(chunk))
  stream.on('end', () => {
    torrentClient.destroy()

    console.log()

    let actualHash = hasher.digest().toString('hex')

    // TODO: verify SHA256SUMS against signing key

    // get known hash from SHA256SUMS file
    let shasums = readFileSync(shasumPath).toString()
    let expectedHash
    for (let line of shasums.split('\n').slice(3)) {
      let [ shasum, filename ] = line.split(/\s+/)
      if (shasum.length !== 64) continue
      if (archiveFilename.endsWith(filename)) {
        expectedHash = shasum
        break
      }
    }

    if (actualHash !== expectedHash) {
      console.error('ERROR: hash of downloaded Bitcoin Core binaries did not match')
      process.exit(1)
    }

    console.log('✅ verified hash of Bitcoin Core binaries\n')
    renameSync(tempBinPath, binPath)
    rimraf(extractPath)

    mkdirp(dirname(cacheBinPath))
    copyFileSync(binPath, cacheBinPath)
  })

  // increment progress bar
  stream.on('data', (chunk) => bar.tick(chunk.length / 1e6 * 8))
})

// gets a URL to the .tar.gz or .zip, hosted on bitcoin.org
function getArchiveFilename (version) {
  function withPrefix (filename) {
    return `bitcoin-${version}-${filename}`
  }

  function throwUnknownArchError () {
    throw Error(`Arch "${process.arch}" not supported`)
  }

  switch (process.platform) {
    case 'darwin':
      return withPrefix('osx64.tar.gz')
    case 'linux':
      switch (process.arch) {
        case 'x32':
          return withPrefix('i686-pc-linux-gnu.tar.gz')
        case 'x64':
          return withPrefix('x86_64-linux-gnu.tar.gz')
        case 'arm':
          return withPrefix('arm-linux-gnueabihf.tar.gz')
        case 'arm64':
          return withPrefix('aarch64-linux-gnu.tar.gz')
        default:
          throwUnknownArchError()
      }
    // TODO: support windows
    // case 'win32':
    //   switch (process.arch) {
    //     case 'x32':
    //       return withPrefix('win32.zip')
    //     case 'x64':
    //       return withPrefix('win64.zip')
    //     default:
    //       throwUnknownArchError()
    //   }
  }

  throw Error(`Platform "${process.platform}" is not supported`)
}
