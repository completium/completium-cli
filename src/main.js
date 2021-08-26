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
const encoder = require('@taquito/michelson-encoder');
const bip39 = require('bip39');
const signer = require('@taquito/signer');
const archetype = require('@completium/archetype');
// const archetype = require('/home/dev/archetype/archetype-lang/npm-package/dist/index.js');
const { BigNumber } = require('bignumber.js');
const { exit } = require('process');
const { emitMicheline } = require('@taquito/michel-codec');

const version = '0.2.1'

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
var mockup_mode = true;

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
    print(`Completium is not initialized, try 'completium-cli init'`);
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
    print(`Completium is not initialized, try 'completium-cli init'`);
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

function renameAccountInternal(src, dst, callback) {
  var obj = getAccounts();
  obj.accounts = obj.accounts.map(x => x.name === src ? { ...x, name: dst } : x)
  saveFile(accounts_path, obj, callback);
}

function removeAccountInternal(name, callback) {
  var obj = getAccounts();
  obj.accounts = obj.accounts.filter(x => { return (name !== x.name) });
  saveFile(accounts_path, obj, callback);
}

function removeContractInternal(input, callback) {
  var obj = getContracts();
  obj.contracts = obj.contracts.filter(x => { return (input !== x.name && input !== x.address) });
  saveFile(contracts_path, obj, callback);
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

function computeSettings(options, settings) {
  const metadata_storage = options.metadata_storage;
  const metadata_uri = options.metadata_uri;
  const otest = options.test;

  return {
    ...settings,
    "test_mode": otest,
    "metadata_storage": metadata_storage,
    "metadata_uri": metadata_uri
  }
}

function callArchetype(options, input, s) {
  const verbose = options.verbose;
  const no_print = options.no_print === undefined ? false : options.no_print;

  const settings = computeSettings(options, s);

  if (verbose) {
    print(settings);
  }

  try {
    const res = archetype.compile(input.toString(), settings);
    return res;
  } catch (error) {
    if (!no_print)
      print(error);
    throw error;
  }
}

function micheline_to_json(input) {
  return (JSON.stringify((new codec.Parser()).parseMichelineExpression(input.toString())));
}

function expr_micheline_to_json(input) {
  return (new codec.Parser()).parseMichelineExpression(input.toString());
}

function getAmount(raw) {
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (isNull(v)) {
    print_error(`'${raw}' is an invalid value; expecting for example, 1tz or 2utz.`);
    return null;
  }
  var value = Math.abs(v.str) * (v.utz ? 1 : 1000000);
  if (!Number.isInteger(value)) {
    print(`'${raw}' is an invalid value; '${value}' is not an integer.`);
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
    const v = archetype.version();
    resolve(v)
  });
}

//////////////
// COMMANDS //
//////////////

function help(options) {
  print("usage: [command] [options]")
  print("command:");
  print("  init")
  print("  help");
  print("  version")
  print("  archetype version")

  print("  set bin <BIN> <PATH>");

  print("  start sandbox");
  print("  stop sandbox");

  print("  show endpoint");
  print("  switch endpoint");
  print("  add endpoint (main|florence|granada|sandbox) <ENDPOINT_URL>");
  print("  set endpoint <ENDPOINT_URL>");
  print("  remove endpoint <ENDPOINT_URL>");

  print("  generate account as <ACCOUNT_ALIAS> [--force]");
  print("  import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]");
  print("  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]");

  print("  show keys from <PRIVATE_KEY>");
  print("  set account <ACCOUNT_ALIAS>");
  print("  switch account");
  print("  rename account <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> by <ACCOUNT_ALIAS> [--force]");
  print("  remove account <ACCOUNT_ALIAS>");

  print("  transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> [--force]");
  print("  deploy <FILE.arl> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--init <MICHELSON_DATA> | --parameters <PARAMETERS>] [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>] [--force]");
  print("  originate <FILE.tz> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--force]");
  print("  call <CONTRACT_ALIAS> [--as <ACCOUNT_ALIAS>] [--entry <ENTRYPOINT>] [--args <ARGS> | --args-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--force]");
  print("  generate michelson <FILE.arl|CONTRACT_ALIAS>");
  print("  generate javascript <FILE.arl|CONTRACT_ALIAS>");
  print("  generate whyml <FILE.arl|CONTRACT_ALIAS>");

  print("  show accounts");
  print("  show account [--with-private-key]");
  print("  show contracts");
  print("  show contract <CONTRACT_ALIAS>");
  print("  show entries <CONTRACT_ADDRESS>");
  print("  rename contract <CONTRACT_ALIAS|CONTRACT_ADDRESS> by <CONTRACT_ALIAS> [--force]");
  print("  remove contract <CONTRACT_ALIAS>");
  print("  show url <CONTRACT_ALIAS>");
  print("  show source <CONTRACT_ALIAS>");
  print("  show address <CONTRACT_ALIAS|ACCOUNT_ALIAS>");
  print("  show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--json]");
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
      "tezos-client": "tezos-client"
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
        },
        {
          network: "mockup",
          bcd_url: "",
          endpoints: [
            "mockup"
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

async function setBin(options) {
  const bin = options.bin;
  if (bin !== 'tezos-client') {
    return print(`Expecting bin 'tezos-client'`);
  }
  const path = options.path;
  setBinConfig(bin, path, "'tezos-client' path set.");
}

async function startSandbox(options) {
  const verbose = options.verbose;
  print('Waiting for sandbox to start ...');
  try {
    const { stdout } = await execa('docker', ['run', '--rm', '--name', 'my-sandbox', '--cpus', '1', '-e', 'block_time=10', '--detach', '-p', '20000:20000',
      docker_id, 'granabox', 'start'], {});
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

async function showArchetypeVersion(options) {
  const vers = await getArchetypeVersion();
  print(vers);
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
    return print(`'${network}' is not found, expecting one of ${networks}.`)
  }

  if (cnetwork.endpoints.includes(endpoint)) {
    return print(`'${endpoint}' is already registered.`)
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
      print(`'${endpoint}' is not found.`);
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
    return print(`'${endpoint}' is not found.`);
  }


  if (config.tezos.endpoint === endpoint) {
    return print(`Cannot remove endpoint '${endpoint}' because it is currently set as the default endpoint. Switch to another endpoint before removing.`);
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
    print("No account is set.");
  } else {
    const account = getAccount(value);
    if (isNull(account)) {
      return print(`'${account}' is not found.`);
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
      print(`'${value}' is not found.`);
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

async function renameAccount(options) {
  const from = options.from;
  const to = options.to;
  const force = options.force;

  const accountFrom = getAccountFromIdOrAddr(from);
  if (isNull(accountFrom)) {
    return print(`'${from}' is not found.`);
  }

  const config = getConfig();
  if (config.account === from) {
    return print(`Cannot rename account '${from}' because it is currently set as the default account. Switch to another account before renaming.`);
  }

  var confirm = await confirmAccount(force, to);
  if (!confirm) {
    return;
  }

  var f = function () { renameAccountInternal(from, to, x => { print(`account '${accountFrom.pkh}' has been renamed from '${accountFrom.name}' to '${to}'.`) }) };


  const accountTo = getAccount(to);
  if (!isNull(accountTo)) {
    removeAccountInternal(to, y => { f() });
  } else {
    f();
  }
}

async function removeAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    return print(`'${value}' is not found.`);
  }

  const config = getConfig();
  if (config.account === value) {
    return print(`Cannot remove account '${value}' because it is currently set as the default account. Switch to another account before removing.`);
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
    print(`'${from_raw}' is not found.`);
    return;
  }
  var accountTo = getAccountFromIdOrAddr(to_raw);
  if (isNull(accountTo) && !to_raw.startsWith('tz')) {
    print(`'${to_raw}' bad account or address.`);
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

async function copyContract(data, contract_name) {
  return new Promise(resolve => {
    const contract_path = contracts_dir + '/' + contract_name + ".tz";
    fs.writeFile(contract_path, data, (err) => {
      if (err) throw err;
      resolve(contract_path);
    });
  });
}

function is_number(v) {
  try {
    const bigNumber = new BigNumber(v);
    if (bigNumber.isNaN()) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function build_from_js(type, jdata) {

  if (type.prim !== undefined) {
    const schema = new encoder.Schema(type);
    const prim = type.prim;
    switch (prim) {
      case 'address':
      case 'bls12_381_fr':
      case 'bls12_381_g1':
      case 'bls12_381_g2':
      case 'bool':
      case 'bytes':
      case 'chain_id':
      case 'contract':
      case 'int':
      case 'key':
      case 'key_hash':
      case 'lambda':
      case 'list':
      case 'nat':
      case 'never':
      case 'operation':
      case 'option':
      case 'sapling_state':
      case 'sapling_transaction':
      case 'set':
      case 'signature':
      case 'string':
      case 'ticket':
      case 'mutez':
        if (typeof jdata === "string" && jdata.endsWith("tz")) {
          const v = getAmount(jdata);
          return { "int": v.toString() }
        } else {
          return schema.Encode(jdata);
        }
      case 'unit':
        return schema.Encode(jdata);
      case 'timestamp':
        let vdate;
        if (is_number(jdata)) {
          vdate = jdata.toString();
        } else {
          const toTimestamp = (strDate) => {
            var datum = Date.parse(strDate);
            return (datum / 1000).toString();
          }
          vdate = toTimestamp(jdata);
        }
        return schema.Encode(vdate);
      case 'big_map':
      case 'map':
        const kmtype = type.args[0];
        const vmtype = type.args[1];
        const mdata = jdata.map((x) => {
          if (x.key === undefined || x.value === undefined) {
            throw new Error("Type map error: no 'key' or 'value' for one item")
          }
          const k = build_from_js(kmtype, x.key);
          const v = build_from_js(vmtype, x.value);
          return { "prim": "Elt", args: [k, v] };
        });
        return mdata;
      case 'or':
        if (jdata.kind === undefined || jdata.value === undefined) {
          throw new Error("Type or error: no 'kind' or 'value' field")
        }
        const odata = jdata.value;
        switch (jdata.kind.toLowerCase()) {
          case 'left':
            const ldata = build_from_js(type.args[0], odata);
            return { "prim": "Left", args: [ldata] };
          case 'right':
            const rdata = build_from_js(type.args[1], odata);
            return { "prim": "Right", args: [rdata] };
          default:
            throw new Error("Unknown type or: " + jdata.kind)
        }
      case 'pair':
        const pargs = [];
        if (jdata.length < type.args.length) {
          throw new Error("Unknown type pair: length error data:" + jdata.length + " type: " + type.args.length);
        }
        for (let i = 0; i < type.args.length; ++i) {
          const data = build_from_js(type.args[i], jdata[i]);
          pargs.push(data);
        }
        return { "prim": "Pair", args: pargs };
      default:
        throw new Error("Unknown type prim: " + prim)
    }

  } else {
    throw new Error("Unknown type")
  }
}

function build_data_michelson(type, storage_values, parameters) {
  if (type.annots !== undefined && type.annots.length > 0) {
    const annot1 = type.annots[0];
    const annot = annot1.startsWith("%") ? annot1.substring(1) : annot1;

    if (parameters[annot] !== undefined) {
      const t = type;
      const d = parameters[annot];
      const data = build_from_js(t, d);
      return data;
    } else if (storage_values[annot] !== undefined) {
      const data = expr_micheline_to_json(storage_values[annot]);
      return data;
    } else {
      throw new Error(annot + " is not found.");
    }

  } else if (type.prim !== undefined && type.prim === "pair" && type.annots === undefined) {

    let args;
    if (Object.keys(storage_values).length == 0 && Object.keys(parameters).length == 1) {
      const ds = Object.values(parameters)[0];
      args = [];
      for (let i = 0; i < type.args.length; ++i) {
        const d = ds[i];
        const t = type.args[i];
        const a = build_from_js(t, d);
        args.push(a);
      }
    } else {
      args = type.args.map((t) => {
        return build_data_michelson(t, storage_values, parameters);
      });
    }

    return { "prim": "Pair", args: args };
  } else {
    const d = Object.values(parameters)[0];
    return build_from_js(type, d);
  }
}

function compute_tzstorage(input, storageType, parameters, s) {
  const storage_values = archetype.get_storage_values(input, s);
  const jsv = JSON.parse(storage_values);
  const sv = jsv.map(x => x);
  var obj = {};
  sv.forEach(x => {
    obj[x.id] = x.value
  });

  const data = build_data_michelson(storageType, obj, parameters);
  const michelsonData = data;

  return michelsonData;
}

function print_deploy_settings(with_color, account, contract_id, amount, storage, estimated_total_cost) {
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';
  print(`Originate settings:`);
  print(`  ${start}network${end}\t: ${config.tezos.network}`);
  print(`  ${start}contract${end}\t: ${contract_id}`);
  print(`  ${start}by${end}\t\t: ${account.name}`);
  print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  print(`  ${start}storage${end}\t: ${storage}`);
  print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
}

async function confirmDeploy(force, account, contract_id, amount, storage, estimated_total_cost) {
  if (force) { return true }

  const Confirm = require('prompt-confirm');
  print_deploy_settings(true, account, contract_id, amount, storage, estimated_total_cost);
  return new Promise(resolve => { new Confirm("Confirm settings").ask(answer => { resolve(answer); }) });
}

async function deploy(options) {
  const config = getConfig();

  const originate = options.originate;
  const file = options.file;
  const as = options.as;
  const force = options.force;
  const named = options.named;
  const network = config.tezos.list.find(x => x.network === config.tezos.network);
  const dry = options.dry;
  const oinit = options.init;
  const parameters = options.iparameters !== undefined ? JSON.parse(options.iparameters) : options.parameters;
  const otest = options.test;
  const quiet = options.quiet === undefined ? false : options.quiet;

  if (otest && originate) {
    const msg = `Cannot originate a contract in test mode.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (otest && network.network === "main") {
    const msg = `Cannot deploy a contract in test mode on mainnet.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const account = getAccountFromIdOrAddr(isNull(as) ? config.account : as);
  if (isNull(account)) {
    let msg;
    if (isNull(as)) {
      msg = `Invalid account ${as}.`;
    } else {
      if (config.account === "") {
        msg = `Account is not set.`;
      } else {
        msg = `Invalid account ${config.account}.`;
      }
    }
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const amount = isNull(options.amount) ? 0 : getAmount(options.amount);
  if (isNull(amount)) {
    const msg = `Invalid amount`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const fee = isNull(options.fee) ? 0 : getAmount(options.fee);
  if (isNull(fee)) {
    const msg = `Invalid fee`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const contract_name = named === undefined ? path.basename(file).split('.').slice(0, -1).join('.') : named;
  var confirm = await confirmContract(force, contract_name);
  if (!confirm) {
    const msg = `Not confirmed`
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const input = fs.readFileSync(file).toString();
  if (!fs.existsSync(file)) {
    const msg = `File not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let code;
  if (originate) {
    code = input;
  } else {
    try {
      code = callArchetype(options, input.toString(), {
        target: "michelson",
        sci: account.pkh
      });
    } catch (e) {
      return new Promise((resolve, reject) => { reject(e) });
    }
  }
  const m_code = expr_micheline_to_json(code);

  if (!originate && isNull(parameters)) {
    const with_parameters = archetype.with_parameters(input);
    if (with_parameters) {
      const msg = `The contract has the following parameter:\n${res}\nPlease use '--parameters' to initialize.`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  let m_storage;
  if (!isNull(oinit)) {
    m_storage = expr_micheline_to_json(oinit);
  } else if (!originate) {
    if (isNull(parameters)) {
      try {
        const storage = callArchetype(options, input.toString(), {
          target: "michelson-storage",
          sci: account.pkh
        });
        m_storage = expr_micheline_to_json(storage);
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    } else {
      try {
        const obj_storage = m_code.find(x => x.prim === "storage");
        const storageType = obj_storage.args[0];
        m_storage = compute_tzstorage(input.toString(), storageType, parameters, computeSettings(options));
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    }
  } else {
    m_storage = expr_micheline_to_json("Unit");
  }

  const ext = originate ? 'tz' : 'arl';
  const source = await copySource(file, ext, contract_name);
  const contract_path = await copyContract(code, contract_name);
  const version = await getArchetypeVersion();

  const tezos = getTezos(account.name);

  const originateParam = {
    balance: amount,
    fee: fee > 0 ? fee : undefined,
    code: m_code,
    init: m_storage,
    mutez: true
  };

  if (dry) {
    // taquito.RpcPacker.preapplyOperations();
    print("TODO")
  } else {

    const storage = codec.emitMicheline(m_storage);

    let cont;
    try {
      const res_estimate = await tezos.estimate.originate(originateParam);
      const estimated_total_cost = res_estimate.totalCost + 100;
      // const estimated_total_cost = 0;
      cont = await confirmDeploy(force, account, contract_name, amount, storage, estimated_total_cost);
      if (!cont) {
        return new Promise((resolve, reject) => { resolve([null, null]) });
      }
      if (!quiet) {
        if (force) {
          print_deploy_settings(false, account, contract_name, amount, storage, estimated_total_cost);
        } else {
          print(`Forging operation...`);
        }
      }

    } catch (e) {
      return new Promise((resolve, reject) => { reject(e) });
    }

    return new Promise((resolve, reject) => {
      var op = null;
      tezos.contract
        .originate(originateParam)
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
            path: contract_path,
            initial_storage: storage,
            source: source
          },
            x => {
              print(`Origination completed for ${contract.address} named ${contract_name}.`);
              const url = network.bcd_url.replace('${address}', contract.address);
              print(url);
              return resolve([contract_name, op])
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
}

function print_settings(with_color, account, contract_id, amount, entry, arg, estimated_total_cost) {
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';
  print(`Call settings:`);
  print(`  ${start}network${end}\t: ${config.tezos.network}`);
  print(`  ${start}contract${end}\t: ${contract_id}`);
  print(`  ${start}by${end}\t\t: ${account.name}`);
  print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  print(`  ${start}entrypoint${end}\t: ${entry}`);
  print(`  ${start}argument${end}\t: ${arg}`);
  print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
}

async function confirmCall(force, account, contract_id, amount, entry, arg, estimated_total_cost) {
  if (force) { return true }

  const Confirm = require('prompt-confirm');
  print_settings(true, account, contract_id, amount, entry, arg, estimated_total_cost);
  return new Promise(resolve => { new Confirm("Confirm settings").ask(answer => { resolve(answer); }) });
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
    print(`Account '${as}' is not found.`);
    return null;
  }

  const amount_raw = isNull(options.amount) ? '0tz' : options.amount;
  const amount = getAmount(amount_raw);
  if (isNull(amount)) {
    return;
  }

  const fee = isNull(options.fee) ? 0 : getAmount(options.fee);
  if (isNull(fee)) { return new Promise(resolve => { resolve(null) }); };

  const tezos = getTezos(account.name);

  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  const transferParam = { to: contract_address, amount: amount, fee: fee > 0 ? fee : undefined, mutez: true, parameter: { entrypoint: entry, value: arg } };

  try {
    const res = await tezos.estimate.transfer(transferParam);
    const estimated_total_cost = res.totalCost + 100;
    const arg_michelson = codec.emitMicheline(arg);
    var confirm = await confirmCall(force, account, contract_id, amount, entry, arg_michelson, estimated_total_cost);
    if (!confirm) {
      return;
    }

    if (!quiet) {
      if (force) {
        print_settings(false, account, contract_id, amount, entry, arg_michelson, estimated_total_cost);
      } else {
        print(`Forging operation...`);
      }
    }
  } catch (e) {
    if (e.errors != undefined && e.errors.length > 0) {
      let msgs = [];
      let contract;
      const errors = e.errors.map(x => x);
      errors.forEach(x => {
        if (x.contract_handle !== undefined || x.contract !== undefined) {
          contract = x.contract_handle !== undefined ? x.contract_handle : x.contract;
          const cid = getContractFromIdOrAddress(contract);
          let msg = `Error from contract ${contract}`;
          if (!isNull(cid)) {
            msg += ` (${cid.name})`
          }
          msg += ":";
          msgs.push(msg);
        } else if (x.kind === "temporary" &&
          x.location !== undefined &&
          x.with !== undefined) {
          const d = codec.emitMicheline(x.with);
          const msg = `failed at ${x.location} with ${d}`;
          msgs.push(msg);
        }
        if (x.expected_type !== undefined && x.wrong_expression !== undefined) {
          const etyp = codec.emitMicheline(x.expected_type);
          const wexp = codec.emitMicheline(x.wrong_expression);
          let msg = `Invalid argument value '${wexp}'; excepting value of type '${etyp}'`;
          msgs.push(msg);
        }
      })
      throw new Error(msgs.join("\n"));
    } else {
      throw e
    }
  }

  return new Promise((resolve, reject) => {
    tezos.contract
      .transfer(transferParam)
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

async function computeArg(args, contract, entry) {
  let paramType = contract.entrypoints.entrypoints[entry];
  if (isNull(paramType) && entry === "default") {
    paramType = contract.parameterSchema.root.val;
  }
  const michelsonData = build_data_michelson(paramType, {}, args);
  return michelsonData;
}

async function callContract(options) {
  const input = options.contract;
  const args = options.iargs !== undefined ? JSON.parse(options.iargs) : options.args;
  var argMichelson = options.argsMichelson;
  var entry = options.entry === undefined ? 'default' : options.entry;

  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;

  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      const msg = `Expecting network ${contract.network}. Switch endpoint and retry.`;
      throw new Error(msg);
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      const msg = `'${contract_address}' unknown contract alias or bad contract address.`;
      throw new Error(msg);
    }
  }

  let ct;
  try {
    ct = await getTezosContract(contract_address);
  } catch (e) {
    const msg = `'${contract_address}' not found on ${config.tezos.network}.`;
    throw new Error(msg);
  }

  if (entry !== 'default') {
    if (ct.entrypoints === undefined ||
      ct.entrypoints.entrypoints[entry] === undefined) {
      const msg = `'${entry}' entrypoint not found.`;
      throw new Error(msg);
    }
  }

  if (argMichelson !== undefined) {
    arg = expr_micheline_to_json(argMichelson);
  } else if (args !== undefined) {
    arg = await computeArg(args, ct, entry);
  } else {
    arg = { prim: "Unit" };
  }
  const res = await callTransfer(options, contract_address, arg);
  return res;
}

async function setNow(options) {
  const vdate = options.date;

  return await callContract({ ...options, entry: "_set_now", args: { "": vdate } });
}

async function generateMichelson(options) {
  const value = options.path;

  const contract = getContract(value);

  var x = value;
  if (!isNull(contract)) {
    x = contract.source;
  }

  if (!fs.existsSync(x)) {
    print(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }
  const input = fs.readFileSync(x).toString();

  const res = callArchetype(options, input, {
    target: 'michelson'
  });
  print(res);
}

async function generateJavascript(options) {
  const value = options.path;

  const contract = getContract(value);

  var x = value;
  if (!isNull(contract)) {
    x = contract.source;
  }

  if (!fs.existsSync(x)) {
    print(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }
  const input = fs.readFileSync(x).toString();

  const res = callArchetype(options, input, {
    target: 'javascript'
  });
  print(res);
}

async function generateWhyml(options) {
  const value = options.path;

  const contract = getContract(value);

  var x = value;
  if (!isNull(contract)) {
    x = contract.source;
  }

  if (!fs.existsSync(x)) {
    print(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }
  const input = fs.readFileSync(x).toString();

  const res = callArchetype(options, input, {
    target: 'whyml'
  });
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
    print(`Contract '${input}' is not found.`);
    return;
  }

  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === contract.network);
  const url = network.bcd_url.replace('${address}', contract.address);

  const with_color = true;
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';

  print(`${start}Name${end}     : ${contract.name}`);
  print(`${start}Network${end}  : ${contract.network}`);
  print(`${start}Address${end}  : ${contract.address}`);
  print(`${start}Source${end}   : ${contract.source}`);
  print(`${start}Language${end} : ${contract.language}`);
  print(`${start}Version${end}  : ${contract.compiler_version}`);
  print(`${start}Url${end}      : ${url}`);
  if (contract.path !== undefined) {
    print(`${start}Path${end}     : ${contract.path}`);
  }
  if (contract.initial_storage !== undefined) {
    print(`${start}Storage${end}  : ${contract.initial_storage}`);
  }
}

async function getEntries(input, rjson, callback) {
  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      throw new Error(`Expecting network ${contract.network}. Switch endpoint and retry.`);
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      throw new Error(`'${contract_address}' bad contract address.`);
    }
  }

  retrieveContract(contract_address, x => {
    (async () => {
      if (!fs.existsSync(x)) {
        throw new Error(`File not found.`);
      }
      const input = fs.readFileSync(x).toString();
      const res = archetype.show_entries(input, {
        json: true,
        rjson: rjson
      });
      callback(res);
    })();
  });
}

async function showEntries(options) {
  const input = options.contract;
  await getEntries(input, false, print);
}

async function renameContract(options) {
  const from = options.from;
  const to = options.to;
  const force = options.force;

  const contractFrom = getContractFromIdOrAddress(from);
  if (isNull(contractFrom)) {
    return print(`'${from}' is not found.`);
  }

  var confirm = await confirmContract(force, to);
  if (!confirm) {
    return;
  }

  var f = function () {
    var obj = getContracts();
    obj.contracts = obj.contracts.map(x => x.name === from ? { ...x, name: to } : x);
    saveFile(contracts_path, obj, x => { print(`contract '${contractFrom.address}' has been renamed from '${contractFrom.name}' to '${to}'.`) });
  };

  const contractTo = getContract(to);
  if (!isNull(contractTo)) {
    removeContractInternal(to, y => { f() });
  } else {
    f();
  }
}

async function removeContract(options) {
  const input = options.contract;

  var contract = getContractFromIdOrAddress(input);

  if (isNull(contract)) {
    print(`Contract '${input}' is not found.`);
    return;
  }

  removeContractInternal(input, x => { print(`contract '${contract.name}' is removed (${contract.address}).`) });
}

async function showUrl(options) {
  const name = options.contract;
  const c = getContract(name);
  if (isNull(c)) {
    print(`Contract '${name}' is not found.`);
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
    print(`Contract '${name}' is not found.`);
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
      print(`Alias '${value}' is not found.`);
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
      print(`Expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      print(`'${contract_address}' bad contract address.`);
      return;
    }
  }
  return contract_address;
}

async function showStorage(options) {
  const input = options.value;
  const json = options.json || false;

  const contract_address = getContractAddress(input);

  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const url = tezos_endpoint + '/chains/main/blocks/head/context/contracts/' + contract_address + '/storage';
  var request = require('request');
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      const j = JSON.parse(body);
      if (json) {
        print(JSON.stringify(j, 0, 2));
      } else {
        print(codec.emitMicheline(j))
      }
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

function commandNotFound(options) {
  print("commandNotFound: " + options.command);
  help(options);
  return 1;
}

async function exec(options) {
  try {
    switch (options.command) {
      case "init":
        await initCompletium(options);
        break;
      case "help":
        help(options);
        break;
      case "show_version":
        await showVersion(options);
        break;
      case "show_archetype_version":
        await showArchetypeVersion(options);
        break;
      case "set_bin":
        await setBin(options);
        break;
      case "start_sandbox":
        await startSandbox(options);
        break;
      case "stop_sandbox":
        await stopSandbox(options);
        break;
      case "show_endpoint":
        await showEndpoint(options);
        break;
      case "switch_endpoint":
        await switchEndpoint(options);
        break;
      case "add_endpoint":
        await addEndpoint(options);
        break;
      case "set_endpoint":
        await setEndpoint(options);
        break;
      case "remove_endpoint":
        await removeEndpoint(options);
        break;
      case "generate_account":
        await generateAccount(options);
        break;
      case "import_faucet":
        await importFaucet(options);
        break;
      case "import_privatekey":
        await importPrivatekey(options);
        break;
      case "show_keys_from":
        await showKeysFrom(options);
        break;
      case "show_accounts":
        await showAccounts(options);
        break;
      case "show_account":
        await showAccount(options);
        break;
      case "set_account":
        await setAccount(options);
        break;
      case "switch_account":
        await switchAccount(options);
        break;
      case "rename_account":
        await renameAccount(options);
        break;
      case "remove_account":
        await removeAccount(options);
        break;
      case "transfer":
        await transfer(options);
        break;
      case "deploy":
      case "originate":
        await deploy(options);
        break;
      case "call_contract":
        await callContract(options);
        break;
      case "generate_michelson":
        await generateMichelson(options);
        break;
      case "generate_javascript":
        await generateJavascript(options);
        break;
      case "generate_whyml":
        await generateWhyml(options);
        break;
      case "show_contracts":
        await showContracts(options);
        break;
      case "show_contract":
        await showContract(options);
        break;
      case "show_entries":
        await showEntries(options);
        break;
      case "rename_contract":
        await renameContract(options);
        break;
      case "remove_contract":
        await removeContract(options);
        break;
      case "show_url":
        await showUrl(options);
        break;
      case "show_source":
        await showSource(options);
        break;
      case "show_address":
        await showAddress(options);
        break;
      case "show_storage":
        await showStorage(options);
        break;
      case "get_balance_for":
        await getBalanceFor(options);
        break;
      default:
        commandNotFound(options);
    }
  } catch (e) {
    if (e.message !== undefined) {
      print_error(e.message);
    } else {
      print_error(e);
    }
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
exports.transfer = transfer;
exports.getEntries = getEntries;
