/*!
 * completium-cli <https://github.com/edukera/completium-cli>
 *
 * Copyright (c) 2021, edukera, SAS.
 * Released under the MIT License.
 */

const fs = require('fs');
const wget = require('node-wget');
const execa = require('execa');
const path = require('path');
const taquito = require('@taquito/taquito');
const taquitoUtils = require('@taquito/utils');
const codec = require('@taquito/michel-codec');
const bip39 = require('bip39');
const signer = require('@taquito/signer');

const version = '0.1.21'

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const config_path = completium_dir + '/config.json'
const accounts_path = completium_dir + '/accounts.json'
const contracts_path = completium_dir + '/contracts.json'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"
const sources_dir = completium_dir + "/sources"

const docker_id = 'tqtezos/flextesa:20210602'

var config = null;

///////////
// TOOLS //
///////////

function print(msg) {
  return console.log(msg);
}

function print_error(msg) {
  return console.error(msg);
}


async function download(url, dest) {
  const request = wget({ url: url, dest: dest, timeout: 2000 });
  return request;
};

function loadJS(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function getConfig() {
  if (config == null)
    config = loadJS(config_path);
  return config;
}

function saveFile(path, c, callback) {
  const content = JSON.stringify(c, null, 2);
  fs.writeFile(path, content, (err) => {
    if (err) return print(err);
    if (callback !== undefined) {
      callback();
    }
  }
  );
}

async function saveConfig(config, callback) {
  await saveFile(config_path, config, callback);
}

function getContracts() {
  if (!fs.existsSync(contracts_path)) {
    print(`Error: completium is not initialized, try 'completium-cli init'`);
    return null;
  }
  const content = fs.readFileSync(contracts_path, 'utf8');
  var res = JSON.parse(content);
  return res;
}

function saveContract(c, callback) {
  var obj = getContracts();
  const name = c.name;
  const a = obj.contracts.find(x => x.name === name);
  if (isNull(a)) {
    obj.contracts.push(c);
  } else {
    obj.contracts = obj.contracts.map(x => x.name === name ? c : x)
  }
  saveFile(contracts_path, obj, callback);
}

function getContract(name) {
  var obj = getContracts();
  var c = obj.contracts.find(x => x.name === name);
  return c;
}

function getContractFromIdOrAddress(input) {
  var obj = getContracts();
  var c = obj.contracts.find(x => x.name === input || x.address === input);
  return c;
}

function getAccounts() {
  if (!fs.existsSync(accounts_path)) {
    print(`Error: completium is not initialized, try 'completium-cli init'`);
    return null;
  }
  var res = JSON.parse(fs.readFileSync(accounts_path, 'utf8'));
  return res;
}

async function saveAccount(c, callback) {
  var obj = getAccounts();
  const name = c.name;
  const a = obj.accounts.find(x => x.name === name);
  if (isNull(a)) {
    obj.accounts.push(c);
  } else {
    obj.accounts = obj.accounts.map(x => x.name === name ? c : x)
  }

  saveFile(accounts_path, obj, callback);
}

function removeAccountInternal(name, callback) {
  var obj = getAccounts();
  obj.accounts = obj.accounts.filter(x => { return (name !== x.name) });
  saveFile(accounts_path, obj, callback);
}

function getAccount(name) {
  var obj = getAccounts();
  return obj.accounts.find(x => x.name === name);
}

function getAccountFromIdOrAddr(input) {
  var obj = getAccounts();
  return obj.accounts.find(x => x.name === input || x.pkh === input);
}

function getSigner(forceAccount) {
  const config = getConfig();
  const account = config.account;
  if (isNull(forceAccount) && isNull(account)) {
    print("Cannot execute this command, please generate an account first.");
    return null;
  }
  var a = isNull(forceAccount) ? account : forceAccount;
  var ac = getAccount(a);
  if (isNull(ac)) {
    print(`${account} is not found.`);
    return null;
  }
  return {
    signer: new signer.InMemorySigner(ac.key.value)
  }
}

function getTezos(forceAccount) {
  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const tezos = new taquito.TezosToolkit(tezos_endpoint);
  var signer = getSigner(forceAccount);
  tezos.setProvider(signer);
  return tezos;
}

function isNull(str) {
  return str === undefined || str === null || str === "";
}

async function callArchetype(options, args) {
  const config = getConfig();
  const verbose = options.verbose;
  const init = options.init;
  const metadata_storage = options.metadata_storage;
  const metadata_uri = options.metadata_uri;
  const no_print = options.no_print === undefined ? false : options.no_print;
  const otest = options.test;

  if (otest) {
    args.push('--test-mode');
  }

  if (init !== undefined) {
    args.push('--init');
    args.push(init)
  }

  if (metadata_storage !== undefined) {
    args.push('--metadata-storage');
    args.push(metadata_storage)
  }

  if (metadata_uri !== undefined) {
    args.push('--metadata-uri');
    args.push(metadata_uri)
  }


  if (verbose) {
    var cmd = config.bin.archetype;
    args.forEach(x => cmd += ' ' + x);
    print(cmd);
  }

  try {
    const { stdout } = await execa(config.bin.archetype, args, {});
    if (verbose) {
      print(stdout);
    }
    return stdout;

  } catch (error) {
    if (!no_print)
      print(error);
    throw error;
  }
}

function getAmount(raw) {
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (isNull(v)) {
    print_error(`Error: ${raw} is an invalid value; expecting for example, 1tz or 2utz.`);
    return null;
  }
  var value = Math.abs(v.str) * (v.utz ? 1 : 1000000);
  if (!Number.isInteger(value)) {
    print(`Error: ${raw} is an invalid value; ${value} is not an integer.`);
    return null;
  }
  return value;
}

function createScript(address, content, callback) {
  const path = scripts_dir + '/' + address + '.json';
  fs.writeFile(path, content, function (err) {
    if (err) throw err;
    callback(path);
  });
}

function retrieveContract(contract_address, callback) {
  var config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const url = tezos_endpoint + '/chains/main/blocks/head/context/contracts/' + contract_address + '/script';
  var request = require('request');
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      createScript(contract_address, body, callback);
    } else {
      print(`Error: ${response.statusCode}`)
    }
  })
}

async function getArchetypeVersion() {
  return new Promise(resolve => {
    const output = callArchetype([], ['--version']);
    resolve(output)
  });
}

//////////////
// COMMANDS //
//////////////

async function help(options) {
  print("usage: [command] [options]")
  print("command:");
  print("  init")
  print("  help");
  print("  version")

  print("  set bin <BIN> <PATH>");
  print("  install bin <BIN>");

  print("  start sandbox");
  print("  stop sandbox");

  print("  show endpoint");
  print("  switch endpoint");
  print("  add endpoint (main|edo|florence|granada|sandbox) <ENDPOINT_URL>");
  print("  set endpoint <ENDPOINT_URL>");
  print("  remove endpoint <ENDPOINT_URL>");

  print("  generate account as <ACCOUNT_ALIAS> [--force]");
  print("  import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]");
  print("  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]");

  print("  show keys from <PRIVATE_KEY>");
  print("  set account <ACCOUNT_ALIAS>");
  print("  switch account");
  print("  remove account <ACCOUNT_ALIAS>");

  print("  transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> [--force]");
  print("  deploy <FILE.arl> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--init <PARAMETERS>] [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>] [--force]");
  print("  originate <FILE.tz> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--init <PARAMETERS>] [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>] [--force] [--init <MICHELSON_DATA>]");
  print("  call <CONTRACT_ALIAS> [--as <ACCOUNT_ALIAS>] [--entry <ENTRYPOINT>] [--with <ARG> | --with-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--force]");
  print("  generate javascript <FILE.arl|CONTRACT_ALIAS>");
  print("  generate whyml <FILE.arl|CONTRACT_ALIAS>");

  print("  show accounts");
  print("  show account [--with-private-key]");
  print("  show contracts");
  print("  show contract <CONTRACT_ALIAS>");
  print("  show entries <CONTRACT_ADDRESS>");
  print("  remove contract <CONTRACT_ALIAS>");
  print("  show url <CONTRACT_ALIAS>");
  print("  show source <CONTRACT_ALIAS>");
  print("  show address <CONTRACT_ALIAS|ACCOUNT_ALIAS>");
  print("  show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS>");
  print("  get balance for <ACCOUNT_NAME|ACCOUNT_ADDRESS>");
}

async function initCompletium(options) {

  if (!fs.existsSync(bin_dir)) {
    fs.mkdirSync(bin_dir, { recursive: true });
  }

  if (!fs.existsSync(contracts_dir)) {
    fs.mkdirSync(contracts_dir, { recursive: true });
  }

  if (!fs.existsSync(scripts_dir)) {
    fs.mkdirSync(scripts_dir, { recursive: true });
  }

  if (!fs.existsSync(sources_dir)) {
    fs.mkdirSync(sources_dir, { recursive: true });
  }

  const config = {
    account: '',
    bin: {
      archetype: 'archetype'
    },
    tezos: {
      network: 'granada',
      endpoint: 'https://granadanet.smartpy.io',
      list: [
        {
          network: 'main',
          bcd_url: "https://better-call.dev/main/${address}",
          tzstat_url: "https://tzstats.com",
          endpoints: [
            'https://mainnet-tezos.giganode.io',
            'https://mainnet.smartpy.io',
            'https://rpc.tzbeta.net',
            'https://api.tez.ie/rpc/mainnet'
          ]
        },
        {
          network: 'edo',
          bcd_url: "https://better-call.dev/edo2net/${address}",
          tzstat_url: "https://edo.tzstats.com",
          endpoints: [
            'https://edonet-tezos.giganode.io',
            'https://edonet.smartpy.io'
          ]
        },
        {
          network: 'florence',
          bcd_url: "https://better-call.dev/florencenet/${address}",
          tzstat_url: "https://florence.tzstats.com",
          endpoints: [
            'https://florence-tezos.giganode.io',
            'https://florencenet.smartpy.io'
          ]
        },
        {
          network: 'granada',
          bcd_url: "https://better-call.dev/granadanet/${address}",
          tzstat_url: "https://granada.tzstats.com",
          endpoints: [
            'https://granada-tezos.giganode.io',
            'https://granadanet.smartpy.io'
          ]
        },
        {
          network: "sandbox",
          bcd_url: "https://localhost:8080/sandbox/${address}",
          endpoints: [
            "http://localhost:20000"
          ]
        }
      ]
    }
  };
  saveFile(config_path, config, (x => {
    saveFile(accounts_path, {
      accounts: [{
        "name": "alice",
        "pkh": "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
        "pubk": "edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn",
        "key": {
          "kind": "private_key",
          "value": "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq"
        }
      },
      {
        "name": "bob",
        "pkh": "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
        "pubk": "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
        "key": {
          "kind": "private_key",
          "value": "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt"
        }
      }]
    }, (y => {
      saveFile(contracts_path, { contracts: [] }, (z => { print("Completium initialized successfully!") }));
    }))
  }));
}

function setBinArchetypeConfig(arc_path, msg) {
  const config = getConfig();
  config.bin.archetype = arc_path;
  saveConfig(config, x => { print(msg) });
}

async function setBin(options) {
  const bin = options.bin;
  if (bin !== 'archetype') {
    return print(`Error: expecting bin archetype`);
  }
  const path_archetype = options.path;
  setBinArchetypeConfig(path_archetype, "archetype set.");
}

async function installBin(options) {
  const bin = options.bin;
  if (bin !== 'archetype') {
    return print(`Error: expecting bin archetype`);
  }

  const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.6/archetype-x64-linux";
  const path_archetype = bin_dir + '/archetype';
  await download(archetype_url, path_archetype);
  fs.chmodSync(path_archetype, '711');
  setBinArchetypeConfig(path_archetype, "archetype installed.");
}


async function startSandbox(options) {
  const verbose = options.verbose;
  print('Waiting for sandbox to start ...');
  try {
    const { stdout } = await execa('docker', ['run', '--rm', '--name', 'my-sandbox', '--cpus', '1', '-e', 'block_time=10', '--detach', '-p', '20000:20000',
      docker_id, 'flobox', 'start'], {});
    if (verbose) {
      print(stdout);
    }
    print('sandbox is running');
    return stdout;

  } catch (error) {
    print(error);
    throw error;
  }
}

async function stopSandbox(options) {
  const verbose = options.verbose;

  try {
    const { stdout } = await execa('docker', ['kill', 'my-sandbox'], {});
    if (verbose) {
      print(stdout);
    }
    print('sandbox is stopped');
    return stdout;

  } catch (error) {
    print(error);
    throw error;
  }
}

async function showVersion(options) {
  print(version);
}

async function showEndpoint(options) {
  var config = getConfig();
  print("Current network: " + config.tezos.network);
  print("Current endpoint: " + config.tezos.endpoint);
}

async function switchEndpoint(options) {
  showEndpoint(options);

  var config = getConfig();

  var res = {
    answers: [],
    indexes: [],
    networks: [],
    endpoints: []
  };

  config.tezos.list.forEach(x => {
    const network = x.network;
    x.endpoints.forEach(y => {
      res.answers.push(`${network.padEnd(10)} ${y}`);
      res.indexes.push(`${network.padEnd(10)} ${y}`);
      res.networks.push(network);
      res.endpoints.push(y);
    });
  });

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch endpoint',
    choices: res.answers,
  });

  prompt.run()
    .then(answer => {
      var i = res.indexes.indexOf(answer);
      const config = getConfig();
      config.tezos.network = res.networks[i];
      config.tezos.endpoint = res.endpoints[i];
      saveConfig(config, x => { print("endpoint updated") });
    })
    .catch(console.error);
}

async function addEndpoint(options) {
  const network = options.network;
  const endpoint = options.endpoint;

  const config = getConfig();
  const cnetwork = config.tezos.list.find(x => x.network === network);

  if (isNull(cnetwork)) {
    const networks = config.tezos.list.map(x => x.network);
    return print(`Error: '${network}' is not found, expecting one of ${networks}.`)
  }

  if (cnetwork.endpoints.includes(endpoint)) {
    return print(`Error: '${endpoint}' is already registered.`)
  }

  cnetwork.endpoints.push(endpoint);

  config.tezos.list = config.tezos.list.map(x => x.network == network ? cnetwork : x);
  saveConfig(config, x => { print(`endpoint '${endpoint}' for network ${network} registered.`) });
}

async function setEndpoint(options) {
  const endpoint = options.endpoint;
  const quiet = options.quiet === undefined ? false : options.quiet;

  const config = getConfig();
  const network = config.tezos.list.find(x => x.endpoints.includes(endpoint));

  if (isNull(network)) {
    if (!quiet)
      print(`Error: ${endpoint} is not found.`);
    return false;
  }

  config.tezos.network = network.network;
  config.tezos.endpoint = endpoint;

  return new Promise(resolve => {
    saveConfig(config, x => {
      if (!quiet)
        print(`endpoint '${endpoint}' for network ${network.network} set.`);
      resolve(true);
    }
    )
  });
}

async function removeEndpoint(options) {
  const endpoint = options.endpoint;
  const config = getConfig();

  const network = config.tezos.list.find(x => x.endpoints.includes(endpoint));

  if (isNull(network)) {
    return print(`Error: '${endpoint}' is not found.`);
  }


  if (config.tezos.endpoint === endpoint) {
    return print(`Error: cannot remove endpoint '${endpoint}' because it is currently set as the default endpoint. Switch to another endpoint before removing.`);
  }

  const l = config.tezos.list.map(x =>
  ({
    ...x,
    endpoints: x.endpoints.filter(e => { return (e !== endpoint) })
  })
  );

  config.tezos.list = l;
  saveConfig(config, x => { print(`'${endpoint}' is removed, configuration file updated.`) });
}

async function confirmAccount(force, account) {
  if (force || isNull(getAccount(account))) { return true }

  const Confirm = require('prompt-confirm');

  const str = `${account} already exists, do you want to overwrite?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
}

async function generateAccount(options) {
  const alias = options.alias;
  const force = options.force;

  var confirm = await confirmAccount(force, alias);
  if (!confirm) {
    return;
  }

  const mnemonic = bip39.generateMnemonic(256);

  const seed = bip39.mnemonicToSeedSync(mnemonic);

  const privateK = taquitoUtils.b58cencode(seed.slice(0, 32), taquitoUtils.prefix.edsk2);
  const signer_ = await signer.InMemorySigner.fromSecretKey(privateK);

  const pubk = await signer_.publicKey();
  const pkh = await signer_.publicKeyHash();
  const prik = await signer_.secretKey();
  saveAccountWithId(alias, pubk, pkh, prik);
}

async function saveAccountWithId(alias, pubk, pkh, prik) {
  saveAccount({ name: alias, pubk: pubk, pkh: pkh, key: { kind: 'private_key', value: prik } },
    x => { print(`Account ${pkh} is registered as '${alias}'.`) });
}

async function importAccount(kind, options) {
  const value = options.value;
  const account = options.account;
  const force = options.force;

  var confirm = await confirmAccount(force, account);
  if (!confirm) {
    return;
  }

  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const tezos = new taquito.TezosToolkit(tezos_endpoint);
  switch (kind) {
    case "faucet":
      const faucet = loadJS(value);
      print(`Importing key ...`);
      await signer.importKey(tezos,
        faucet.email,
        faucet.password,
        faucet.mnemonic.join(' '),
        faucet.secret)
        .catch(console.error);
      break;
    case "privatekey":
      tezos.setProvider({
        signer: new signer.InMemorySigner(value),
      });
      break;
    default:
      break;
  }
  const pubk = await tezos.signer.publicKey();
  const pkh = await tezos.signer.publicKeyHash();
  tezos.signer.secretKey().then(x => {
    saveAccountWithId(account, pubk, pkh, x)
  })
    .catch(console.error);
}

async function importFaucet(options) {
  importAccount("faucet", options);
}

async function importPrivatekey(options) {
  importAccount("privatekey", options);
}

async function showKeysFrom(options) {
  const value = options.value;

  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const tezos = new taquito.TezosToolkit(tezos_endpoint);
  tezos.setProvider({
    signer: new signer.InMemorySigner(value),
  });
  const pubk = await tezos.signer.publicKey();
  const pkh = await tezos.signer.publicKeyHash();
  const prik = await tezos.signer.secretKey();
  showKeyInfo(pubk, pkh, prik);
}

async function showAccounts(options) {
  const accounts = getAccounts();

  accounts.accounts.forEach(x => {
    print(`${x.name.padEnd(30)}\t\t${x.pkh}`);
  });
}

async function showAccount(options) {
  const config = getConfig();
  const value = config.account;
  const withPrivateKey = options.withPrivateKey;

  if (isNull(value)) {
    print("Error: no account is set.");
  } else {
    const account = getAccount(value);
    if (isNull(account)) {
      return print(`Error: ${account} is not found.`);
    }
    const tezos = getTezos();
    print(`Current account:\t${account.name}`);
    showKeyInfo(account.pubk, account.pkh, withPrivateKey ? account.key.value : null);
    var balance = await tezos.tz.getBalance(account.pkh);
    print(`Balance on ${config.tezos.network}:\t${balance.toNumber() / 1000000} ꜩ`);
  }
}

async function showKeyInfo(pubk, pkh, prik) {
  print(`Public  key hash:\t${pkh}`);
  print(`Public  key:\t\t${pubk}`);
  if (prik) {
    print(`Private key:\t\t${prik}`);
  }
}

async function switchAccount(options) {
  const config = getConfig();
  if (!isNull(config.account)) {
    print(`Current account: ${config.account}`);
  }

  const a = getAccounts();
  var res = a.accounts.reduce(((accu, x) => ({
    answers: accu.answers.concat(`${x.name.padEnd(60)} ${x.pkh}`),
    indexes: accu.indexes.concat(`${x.name.padEnd(60)} ${x.pkh}`),
    values: accu.values.concat(x.name)
  })),
    {
      answers: [],
      indexes: [],
      values: []
    });

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch account',
    choices: res.answers,
  });

  prompt.run()
    .then(answer => {
      var i = res.indexes.indexOf(answer);
      const value = res.values[i];
      config.account = value;
      saveConfig(config, x => { print("account updated") });
    })
    .catch(console.error);
}

async function setAccount(options) {
  const value = options.account;
  const quiet = options.quiet === undefined ? false : options.quiet;

  const account = getAccount(value);
  if (isNull(account)) {
    if (!quiet)
      print(`Error: '${value}' is not found.`);
    return false;
  }
  const config = getConfig();
  config.account = value;
  return new Promise(resolve => {
    saveConfig(config, x => {
      if (!quiet)
        print(`'${value}' is set as current account.`);
      resolve(true);
    })
  });
}

async function removeAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    return print(`Error: '${value}' is not found.`);
  }

  const config = getConfig();
  if (config.account === value) {
    return print(`Error: cannot remove account '${value}' because it is currently set as the default account. Switch to another account before removing.`);
  }

  removeAccountInternal(value, x => { print(`'${value}' is removed.`) });
}

async function confirmTransfer(force, amount, from, to) {
  if (force) { return true }

  const config = getConfig();

  const Confirm = require('prompt-confirm');

  const str = `Confirm transfer ${amount / 1000000} ꜩ from ${from.name} to ${to} on ${config.tezos.network}?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
}

async function transfer(options) {
  const amount_raw = options.vamount;
  const from_raw = options.from;
  const to_raw = options.to;
  const force = options.force;

  const amount = getAmount(amount_raw);
  if (isNull(amount)) {
    return;
  }

  const accountFrom = getAccountFromIdOrAddr(from_raw);
  if (isNull(accountFrom)) {
    print(`Error: '${from_raw}' is not found.`);
    return;
  }
  var accountTo = getAccountFromIdOrAddr(to_raw);
  if (isNull(accountTo) && !to_raw.startsWith('tz')) {
    print(`Error: '${to_raw}' bad account or address.`);
    return;
  }
  const to = isNull(accountTo) ? to_raw : accountTo.name;

  var confirm = await confirmTransfer(force, amount, accountFrom, to);
  if (!confirm) {
    return;
  }

  const to_addr = isNull(accountTo) ? to : accountTo.pkh;
  const tezos = getTezos(accountFrom.name);

  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  print(`Transfering ${amount / 1000000} ꜩ from ${accountFrom.pkh} to ${to_addr}...`);
  return new Promise(resolve => {
    tezos.contract
      .transfer({ to: to_addr, amount: amount, mutez: true })
      .then((op) => {
        print(`Waiting for ${op.hash} to be confirmed...`);
        op.confirmation(1)
          .then((hash) => {
            const op_inj = network.tzstat_url === undefined ? `${hash}` : `${network.tzstat_url}/${hash}`
            print(`Operation injected: ${op_inj}`);
            resolve(op);
          })
          .catch((error) => {
            print(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
            resolve(null);
          });
      })
      .catch((error) => {
        print(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
        resolve(null);
      });
  });
}

async function confirmContract(force, id) {
  if (force || isNull(getContract(id))) { return true }

  const Confirm = require('prompt-confirm');

  const str = `${id} already exists, overwrite it?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
}

async function continueContract(force, id, from, amount) {
  if (force) { return true }

  const config = getConfig();

  const Confirm = require('prompt-confirm');

  const str = `Confirm contract ${id} origination by '${from.name}' with ${amount / 1000000} ꜩ on ${config.tezos.network}?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
}

async function copySource(arl, ext, contract_name) {
  return new Promise(resolve => {
    fs.readFile(arl, 'utf8', (err, data) => {
      const source_path = sources_dir + '/' + contract_name + "." + ext;
      fs.writeFile(source_path, data, (err) => {
        if (err) throw err;
        resolve(source_path);
      });
    });
  });
}

async function deploy(options) {
  const config = getConfig();

  const originate = options.originate;
  const verbose = options.verbose;
  const file = options.file;
  const as = options.as;
  const force = options.force;
  const named = options.named;
  const network = config.tezos.list.find(x => x.network === config.tezos.network);
  const dry = options.dry;
  const oinit = options.init;

  const account = getAccountFromIdOrAddr(isNull(as) ? config.account : as);
  if (isNull(account)) {
    if (isNull(as)) {
      print_error(`Error: invalid account ${as}.`);
    } else {
      if (config.account === "") {
        print_error(`Error: account is not set.`);
      } else {
        print_error(`Error: invalid account ${config.account}.`);
      }
    }
    return new Promise(resolve => { resolve(null) });
  }

  const amount = isNull(options.amount) ? 0 : getAmount(options.amount);
  if (isNull(amount)) { return new Promise(resolve => { resolve(null) }); };

  const fee = isNull(options.fee) ? 0 : getAmount(options.fee);
  if (isNull(fee)) { return new Promise(resolve => { resolve(null) }); };

  const contract_name = named === undefined ? path.basename(file).split('.').slice(0, -1).join('.') : named;
  var confirm = await confirmContract(force, contract_name);
  if (!confirm) {
    return new Promise(resolve => { resolve(null) });
  }

  if (!originate) {
    try {
      const res = await callArchetype({ ...options, no_print: true }, ['--get-parameters', file]);
      if (res !== "" && isNull(oinit)) {
        print(`The contract has the following parameter:\n${res}\nPlease use '--init' to initialize.`)
        return new Promise(resolve => { resolve(null) });
      }
    } catch (error) {
      print_error(error.stderr);
      return new Promise(resolve => { resolve(null) });
    }
  }


  const contract_script = contracts_dir + '/' + contract_name + ".tz.js";
  try {
    {
      const res = originate ?
        "export const code = " + await callArchetype(options, ['-d', '-mici', file]) + ";" :
        await callArchetype(options, ['-sci', account.pkh, '-t', 'javascript', '--no-js-header', file]);

      fs.writeFile(contract_script, res, function (err) {
        if (err) throw err;
        if (verbose)
          print(`JS script for contract ${contract_name} is saved.`);
      });
    }
  } catch (error) {
    return new Promise(resolve => { resolve(null) });
  }

  const ext = originate ? 'tz' : 'arl';
  const source = await copySource(file, ext, contract_name);
  const version = await getArchetypeVersion();

  var cont = await continueContract(force, contract_name, account, amount);
  if (!cont) {
    return;
  }

  const tezos = getTezos(account.name);

  var tzstorage = "";
  if (originate) {
    if (isNull(oinit)) {
      tzstorage = { "prim": "Unit" };
    } else {
      var args = [
        '--to-micheline', oinit
      ];
      const output_raw = await callArchetype({ ...options, init: undefined }, args);
      tzstorage = JSON.parse(output_raw);
    }
  } else {
    try {
      const account = getAccount(config.account);
      const res = await callArchetype(options, ['-t', 'michelson-storage', '-sci', account.pkh, file]);
      tzstorage = res;
    } catch (error) {
      return new Promise(resolve => { resolve(null) });
    }
  }

  if (verbose)
    print(tzstorage);

  if (dry) {
    taquito.RpcPacker.preapplyOperations();
    print("TODO")
  } else {
    require = require('esm')(module /*, options*/);
    const c = require(contract_script);
    const code = c.code;
    const init = originate ? tzstorage : c.getStorage();
    if (verbose) {
      const aaa = JSON.stringify(code);
      const bbb = JSON.stringify(init);
      print(`code: ${aaa}`);
      print(`init: ${bbb}`);
    }
    return new Promise(resolve => {
      var op = null;
      tezos.contract
        .originate({
          balance: amount,
          fee: fee > 0 ? fee : undefined,
          code: code,
          init: init,
          mutez: true
        })
        .then((originationOp) => {
          print(`Waiting for confirmation of origination for ${originationOp.contractAddress} ...`);
          op = originationOp;
          return originationOp.contract();
        })
        .then((contract) => {
          saveContract({
            name: contract_name,
            address: contract.address,
            network: config.tezos.network,
            language: originate ? 'michelson' : 'archetype',
            compiler_version: originate ? '0' : version,
            source: source
          },
            x => {
              print(`Origination completed for ${contract.address} named ${contract_name}.`);
              const url = network.bcd_url.replace('${address}', contract.address);
              print(url);
              return resolve(op)
            });
        })
        .catch((error) => { print(`Error: ${JSON.stringify(error, null, 2)}`); resolve(null); });
    });
  }
}

async function confirmCall(force, account, contract_id, amount, entry, arg, network) {
  if (force) { return true }

  const config = getConfig();

  const Confirm = require('prompt-confirm');

  const arg_string = JSON.stringify(arg);
  const str = `Confirm call to entrypoint ${entry} of contract ${contract_id} by '${account.name}' with ${amount / 1000000} ꜩ and argument ${arg_string} on ${config.tezos.network}?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
}

async function callTransfer(options, contract_address, arg) {
  const config = getConfig();
  const force = options.force;
  const entry = options.entry === undefined ? 'default' : options.entry;
  const quiet = options.quiet === undefined ? false : options.quiet;

  const contract_id = options.contract;

  const as = isNull(options.as) ? config.account : options.as;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    print(`Error: account '${as}' is not found.`);
    return null;
  }

  const amount_raw = isNull(options.amount) ? '0tz' : options.amount;
  const amount = getAmount(amount_raw);
  if (isNull(amount)) {
    return;
  }

  const fee = isNull(options.fee) ? 0 : getAmount(options.fee);
  if (isNull(fee)) { return new Promise(resolve => { resolve(null) }); };

  var confirm = await confirmCall(force, account, contract_id, amount, entry, arg);
  if (!confirm) {
    return;
  }

  const tezos = getTezos(account.name);

  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  print(`Account '${account.pkh}' is calling ${entry} of ${contract_address} with ${amount / 1000000} ꜩ...`);

  return new Promise((resolve, reject) => {
    tezos.contract
      .transfer({ to: contract_address, amount: amount, fee: fee > 0 ? fee : undefined, mutez: true, parameter: { entrypoint: entry, value: arg } })
      .then((op) => {
        print(`Waiting for ${op.hash} to be confirmed...`);
        return op.confirmation(1).then(() => op);
      })
      .then((op) => {
        const a = network.tzstat_url !== undefined ? `${network.tzstat_url}/${op.hash}` : `${op.hash}`;
        print(`Operation injected: ${a}`);
        return resolve(op)
      })
      .catch(
        error => {
          if (!quiet)
            print({ ...error, errors: '...' });
          reject(error);
        }
      );
  });
}

async function getArg(options, contract_address, entry) {
  return new Promise(async (resolve) => {
    retrieveContract(contract_address, async (path) => {
      var args = [
        '--expr', options.with,
        '--with-contract', path,
        '--json',
        '--only-expr'
      ];
      if (entry !== 'default') {
        if (entry.charAt(0) !== '%') {
          entry = "%" + entry;
        }
        args.push('--entrypoint', entry);
      }

      const output_raw = await callArchetype(options, args);
      const res = JSON.parse(output_raw);

      resolve(res);
    });
  });
}

async function getMicheline(options, input) {
  return new Promise(async (resolve) => {
    var args = [
      '--to-micheline', input
    ];

    const output_raw = await callArchetype(options, args);
    const res = JSON.parse(output_raw);

    resolve(res);
  });
}

async function callContract(options) {
  const input = options.contract;
  var arg = options.with;
  var argMichelson = options.withMichelson;
  var entry = options.entry === undefined ? 'default' : options.entry;

  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      print(`Error: expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      print(`Error: '${contract_address}' unknown contract alias or bad contract address.`);
      return;
    }
  }

  if (argMichelson !== undefined) {
    arg = await getMicheline(options, argMichelson);
  } else if (arg !== undefined) {
    arg = await getArg(options, contract_address, entry);
  } else {
    arg = { prim: "Unit" };
  }
  const res = await callTransfer(options, contract_address, arg);
  return res;
}

function formatDate(date) {
  return date.toISOString().split('.')[0] + "Z";
}

async function setNow(options) {
  const date = formatDate(options.date);

  return await callContract({ ...options, entry: "_set_now", with: date });
}

async function generateJavascript(options) {
  const value = options.path;

  const contract = getContract(value);

  var x = value;
  if (!isNull(contract)) {
    x = contract.source;
  }

  var args = ['-t', 'javascript', x];
  const res = await callArchetype(options, args);
  print(res);
}

async function generateWhyml(options) {
  const value = options.path;

  const contract = getContract(value);

  var x = value;
  if (!isNull(contract)) {
    x = contract.source;
  }

  var args = ['-t', 'whyml', x];
  const res = await callArchetype(options, args);
  print(res);
}

async function showContracts(options) {
  const contracts = getContracts();

  contracts.contracts.forEach(x => {
    print(`${x.address}\t${x.network}\t${x.name}`);
  });
}

async function showContract(options) {
  const input = options.contract;

  var contract = getContractFromIdOrAddress(input);

  if (isNull(contract)) {
    print(`Error: contract '${input}' is not found.`);
    return;
  }

  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === contract.network);
  const url = network.bcd_url.replace('${address}', contract.address);

  print(`Name:     ${contract.name}`);
  print(`Network:  ${contract.network}`);
  print(`Address:  ${contract.address}`);
  print(`Source:   ${contract.source}`);
  print(`Language: ${contract.language}`);
  print(`Version:  ${contract.compiler_version}`);
  print(`Url:      ${url}`);
}

async function showEntries(options) {
  const input = options.contract;
  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      print(`Error: expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      print(`Error: '${contract_address}' bad contract address.`);
      return;
    }
  }

  retrieveContract(contract_address, x => {
    (async () => {
      var args = ['--show-entries', '--json', x];
      const res = await callArchetype(options, args);
      print(res);
    })();
  });
}

async function removeContract(options) {
  const input = options.contract;

  var contract = getContractFromIdOrAddress(input);

  if (isNull(contract)) {
    print(`Error: contract '${input}' is not found.`);
    return;
  }

  var obj = getContracts();
  obj.contracts = obj.contracts.filter(x => { return (input !== x.name && input !== x.address) });
  saveFile(contracts_path, obj, x => { print(`contract '${contract.name}' is removed (${contract.address}).`) });
}

async function showUrl(options) {
  const name = options.contract;
  const c = getContract(name);
  if (isNull(c)) {
    print(`Error: contract '${name}' is not found.`);
    return;
  }
  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === config.tezos.network);
  const url = network.bcd_url.replace('${address}', c.address);
  print(url);
}

async function showSource(options) {
  const name = options.contract;
  const c = getContract(name);
  if (isNull(c)) {
    print(`Error: contract '${name}' is not found.`);
    return;
  }
  fs.readFile(c.source, 'utf8', (err, data) => {
    if (err) { throw err }
    print(data)
  });
}

async function showAddress(options) {
  const value = options.value;

  var c = getContract(value);
  if (isNull(c)) {
    c = getAccount(value);
    if (isNull(c)) {
      print(`Error: alias '${value}' is not found.`);
      return;
    } else {
      print(c.pkh);
    }
  } else {
    print(c.address);
  }
  return;
}

function getContractAddress(input) {
  const contract = getContract(input);
  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      print(`Error: expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      print(`Error: '${contract_address}' bad contract address.`);
      return;
    }
  }
  return contract_address;
}

async function showStorage(options) {
  const input = options.value;

  const contract_address = getContractAddress(input);

  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const url = tezos_endpoint + '/chains/main/blocks/head/context/contracts/' + contract_address + '/storage';
  var request = require('request');
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      print(JSON.stringify(JSON.parse(body), 0, 2));
    } else {
      print(`Error: ${response.statusCode}`)
    }
  })

  return;
}

async function getTezosContract(input) {
  const contract_address = getContractAddress(input);

  const tezos = getTezos();

  var contract = await tezos.contract.at(contract_address);
  return contract;
}

async function getStorage(input) {
  const contract_address = getContractAddress(input);

  const tezos = getTezos();

  var contract = await tezos.contract.at(contract_address);
  var storage = await contract.storage();
  return storage;
}

async function getBalance(options) {
  const alias = options.alias;

  var pkh = null;
  if (alias === undefined) {
    const config = getConfig();
    const account = getAccount(config.account);
    if (account === undefined) {
      print('Account is not set.');
      return null;
    }
    pkh = account.pkh;
  } else {
    const account = getAccountFromIdOrAddr(alias);
    if (account === undefined) {
      const contract = getContractFromIdOrAddress(alias);
      if (contract === undefined) {
        print(`${alias} is not found.`);
        return null;
      } else {
        pkh = contract.address;
      }
    } else {
      pkh = account.pkh;
    }
  }

  const tezos = getTezos();

  var balance = await tezos.tz.getBalance(pkh);
  return balance;
}

function getAddress(options) {
  const alias = options.alias;

  var address = null;
  const account = getAccount(alias);
  if (account !== undefined) {
    address = account.pkh;
  } else {
    const contract = getContract(alias);
    if (contract !== undefined) {
      address = contract.address;
    }
  }
  return address;
}

async function getBalanceFor(options) {
  const value = options.value;

  const account = getAccountFromIdOrAddr(value);
  var pkh = value;
  if (!isNull(account)) {
    pkh = account.pkh;
  }

  const tezos = getTezos();
  var balance = await tezos.tz.getBalance(pkh);
  print(`${balance.toNumber() / 1000000} ꜩ`);
}

function packTyped(options) {
  const data = options.data;
  const typ = options.typ;

  const packedBytes = codec.packDataBytes(data, typ).bytes;
  return "0x" + packedBytes;
}

function pack(options) {
  var value = options.value;
  var data = {};
  if (Number.isInteger(value)) {
    data = {
      int: value
    };
    typ = {
      prim: "int"
    }
  } else if ((typeof value) === "string") {
    if (value.startsWith('0x')) {
      data = {
        bytes: value.substring(2)
      };
      typ = {
        prim: "bytes"
      }
    } else {
      data = {
        string: value
      };
      typ = {
        prim: "string"
      }
    }
  }
  return packTyped({
    ...options,
    data: data,
    typ: {
      prim: "int"
    }
  });
}

function blake2b(options) {
  const blake = require('blakejs');
  const value = options.value;
  const blakeHash = blake.blake2b(taquitoUtils.hex2buf(value), null, 32);
  return "0x" + taquitoUtils.buf2hex(blakeHash);
}

async function commandNotFound(options) {
  print("commandNotFound: " + options.command);
  help(options);
  return 1;
}

async function exec(options) {
  switch (options.command) {
    case "init":
      initCompletium(options);
      break;
    case "help":
      help(options);
      break;
    case "show_version":
      showVersion(options);
      break;
    case "set_bin":
      setBin(options);
      break;
    case "install_bin":
      installBin(options);
      break;
    case "start_sandbox":
      startSandbox(options);
      break;
    case "stop_sandbox":
      stopSandbox(options);
      break;
    case "show_endpoint":
      showEndpoint(options);
      break;
    case "switch_endpoint":
      switchEndpoint(options);
      break;
    case "add_endpoint":
      addEndpoint(options);
      break;
    case "set_endpoint":
      setEndpoint(options);
      break;
    case "remove_endpoint":
      removeEndpoint(options);
      break;
    case "generate_account":
      generateAccount(options);
      break;
    case "import_faucet":
      importFaucet(options);
      break;
    case "import_privatekey":
      importPrivatekey(options);
      break;
    case "show_keys_from":
      showKeysFrom(options);
      break;
    case "show_accounts":
      showAccounts(options);
      break;
    case "show_account":
      showAccount(options);
      break;
    case "set_account":
      setAccount(options);
      break;
    case "switch_account":
      switchAccount(options);
      break;
    case "remove_account":
      removeAccount(options);
      break;


    case "transfer":
      transfer(options);
      break;
    case "deploy":
    case "originate":
      var op = await deploy(options);
      if (op == null) {
        return 1;
      }
      break;
    case "call_contract":
      callContract(options);
      break;
    case "generate_javascript":
      generateJavascript(options);
      break;
    case "generate_whyml":
      generateWhyml(options);
      break;
    case "show_contracts":
      showContracts(options);
      break;
    case "show_contract":
      showContract(options);
      break;
    case "show_entries":
      showEntries(options);
      break;
    case "remove_contract":
      removeContract(options);
      break;
    case "show_url":
      showUrl(options);
      break;
    case "show_source":
      showSource(options);
      break;
    case "show_address":
      showAddress(options);
      break;
    case "show_storage":
      showStorage(options);
      break;
    case "get_balance_for":
      getBalanceFor(options);
      break;
    default:
      commandNotFound(options);
  }

  return 0;
}

exports.deploy = deploy;
exports.callContract = callContract;
exports.getStorage = getStorage;
exports.getTezosContract = getTezosContract;
exports.getBalance = getBalance;
exports.exec = exec;
exports.setAccount = setAccount;
exports.setEndpoint = setEndpoint;
exports.getAddress = getAddress;
exports.blake2b = blake2b;
exports.pack = pack;
exports.packTyped = packTyped;
exports.setNow = setNow;
exports.formatDate = formatDate;
exports.transfer = transfer;

