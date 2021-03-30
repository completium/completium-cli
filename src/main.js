import fs, { copyFile, exists } from 'fs';
import wget from 'node-wget';
import execa from 'execa';
import path from 'path';
import { TezosToolkit } from '@taquito/taquito';
import { InMemorySigner, importKey } from '@taquito/signer';
import { isNumber } from 'util';
import { config } from 'process';

const version = '0.1.2'

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const config_path = completium_dir + '/config.json'
const accounts_path = completium_dir + '/accounts.json'
const contracts_path = completium_dir + '/contracts.json'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"
const sources_dir = completium_dir + "/sources"

///////////
// TOOLS //
///////////

async function download(url, dest) {
  const request = wget({ url: url, dest: dest, timeout: 2000 });
  return request;
};

function loadJS(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function getConfig() {
  return (loadJS(config_path));
}

async function saveFile(path, c, callback) {
  const content = JSON.stringify(c, null, 2);
  await fs.writeFile(path, content, (err) => { if (err) return console.log(err); });
  if (callback !== undefined) {
    callback();
  }
}

async function saveConfig(config, callback) {
  await saveFile(config_path, config, callback);
}

function getContracts() {
  if (!fs.existsSync(contracts_path)) {
    console.log(`Error: completium is not initialized, try 'completium-cli init'`);
    return null;
  }
  var res = JSON.parse(fs.readFileSync(contracts_path, 'utf8'));
  return res;
}

async function saveContract(c, callback) {
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
    console.log(`Error: completium is not initialized, try 'completium-cli init'`);
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
    console.log("Cannot exectute this command, please generate an account first.");
    return null;
  }
  var a = isNull(forceAccount) ? account : forceAccount;
  var ac = getAccount(a);
  if (isNull(ac)) {
    console.log(`${account} is not found.`);
    return null;
  }
  return {
    signer: new InMemorySigner(ac.key.value)
  }
}

function getTezos(forceAccount) {
  const config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const tezos = new TezosToolkit(tezos_endpoint);
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

  if (init !== undefined) {
    args.push('--init');
    args.push(init)
  }

  try {
    const { stdout } = await execa(config.bin.archetype, args, {});
    if (verbose) {
      console.log(stdout);
    }
    return stdout;

  } catch (error) {
    console.log(error);
    throw error;
  }
}

function getAmount(raw) {
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (isNull(v)) {
    console.error(`Error: ${raw} is an invalid value; expecting for example, 1tz or 2utz.`);
    return null;
  }
  var value = Math.abs(v.str) * (v.utz ? 1 : 1000000);
  if (!Number.isInteger(value)) {
    console.log(`Error: ${raw} is an invalid value; ${value} is not an integer.`);
    return null;
  }
  return value;
}

function createScript(contract, content, callback) {
  const path = scripts_dir + '/' + contract.name + '.json';
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
      console.log(`Error: ${response.statusCode}`)
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
  console.log("usage: [command] [options]")
  console.log("command:");
  console.log("  init")
  console.log("  help");
  console.log("  version")

  console.log("  set bin <BIN> <PATH>");
  console.log("  install bin <BIN>");

  console.log("  show endpoint");
  console.log("  switch endpoint");
  console.log("  add endpoint (main|edo|florence) <ENDPOINT_URL>");
  console.log("  set endpoint <ENDPOINT_URL>");
  console.log("  remove endpoint <ENDPOINT_URL>");

  console.log("  import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]");
  console.log("  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]");

  console.log("  show account");
  console.log("  set account <ACCOUNT_ALIAS>");
  console.log("  switch account");
  console.log("  remove account <ACCOUNT_ALIAS>");

  console.log("  transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> [--force]");
  console.log("  deploy <FILE.arl> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>] [--init <PARAMETERS>] [--force]");
  console.log("  call <CONTRACT_ALIAS> [--as <ACCOUNT_ALIAS>] [--entry <ENTRYPOINT>] [--with <ARG>] [--amount <AMOUNT>] [--force]");
  console.log("  generate javascript <FILE.arl|CONTRACT_ALIAS>");

  console.log("  show contracts");
  console.log("  show contract <CONTRACT_ALIAS>");
  console.log("  show entries <CONTRACT_ADDRESS>");
  console.log("  remove contract <CONTRACT_ALIAS>");
  console.log("  show url <CONTRACT_ALIAS>");
  console.log("  show source <CONTRACT_ALIAS>");
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
      network: 'edo',
      endpoint: 'https://edonet.smartpy.io',
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
          bcd_url: "https://better-call.dev/florence/${address}",
          tzstat_url: "https://florence.tzstats.com",
          endpoints: [
            'https://florence-tezos.giganode.io'
          ]
        }
      ]
    }
  };
  saveFile(config_path, config, (x => {
    saveFile(accounts_path, { accounts: [] }, (y => {
      saveFile(contracts_path, { contracts: [] }, (z => { console.log("Completium initialized successfully!") }));
    }))
  }));
}

function setBinArchetypeConfig(arc_path, msg) {
  const config = getConfig();
  config.bin.archetype = arc_path;
  saveConfig(config, x => { console.log(msg) });
}

async function setBin(options) {
  const bin = options.bin;
  if (bin !== 'archetype') {
    return console.log(`Error: expecting bin archetype`);
  }
  const path_archetype = options.path;
  setBinArchetypeConfig(path_archetype, "archetype set.");
}

async function installBin(options) {
  const bin = options.bin;
  if (bin !== 'archetype') {
    return console.log(`Error: expecting bin archetype`);
  }

  const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.2/archetype-x64-linux";
  const path_archetype = bin_dir + '/archetype';
  await download(archetype_url, path_archetype);
  fs.chmodSync(path_archetype, '711');
  setBinArchetypeConfig(path_archetype, "archetype installed.");
}

async function showVersion(options) {
  console.log(version);
}

async function showEndpoint(options) {
  var config = getConfig();
  console.log("Current network: " + config.tezos.network);
  console.log("Current endpoint: " + config.tezos.endpoint);
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
      saveConfig(config, x => { console.log("endpoint updated") });
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
    return console.log(`Error: '${network}' is not found, expecting one of ${networks}.`)
  }

  if (cnetwork.endpoints.includes(endpoint)) {
    return console.log(`Error: '${endpoint}' is already registered.`)
  }

  cnetwork.endpoints.push(endpoint);

  config.tezos.list = config.tezos.list.map(x => x.network == network ? cnetwork : x);
  saveConfig(config, x => { console.log(`endpoint '${endpoint}' for network ${network} registered.`) });
}

async function setEndpoint(options) {
  const endpoint = options.endpoint;

  const config = getConfig();
  const network = config.tezos.list.find(x => x.endpoints.includes(endpoint));

  if (isNull(network)) {
    return console.log(`Error: ${endpoint} is not found.`);
  }

  config.tezos.network = network.network;
  config.tezos.endpoint = endpoint;
  saveConfig(config, x => { console.log(`endpoint '${endpoint}' for network ${network.network} set.`) });
}

async function removeEndpoint(options) {
  const endpoint = options.endpoint;
  const config = getConfig();

  const network = config.tezos.list.find(x => x.endpoints.includes(endpoint));

  if (isNull(network)) {
    return console.log(`Error: '${endpoint}' is not found.`);
  }


  if (config.tezos.endpoint === endpoint) {
    return console.log(`Error: cannot remove endpoint '${endpoint}' because it is currently set as the default endpoint. Switch to another endpoint before removing.`);
  }

  const l = config.tezos.list.map(x =>
  ({
    ...x,
    endpoints: x.endpoints.filter(e => { return (e !== endpoint) })
  })
  );

  config.tezos.list = l;
  saveConfig(config, x => { console.log(`'${endpoint}' is removed, configuration file updated.`) });
}

async function confirmAccount(force, account) {
  if (force || isNull(getAccount(account))) { return true }

  const Confirm = require('prompt-confirm');

  const str = `${account} already exists, do you want to overwrite?`;
  return new Promise(resolve => { new Confirm(str).ask(answer => { resolve(answer); }) });
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
  const tezos = new TezosToolkit(tezos_endpoint);
  switch (kind) {
    case "faucet":
      const faucet = loadJS(value);
      console.log(`Import key ...`);
      await importKey(tezos,
        faucet.email,
        faucet.password,
        faucet.mnemonic.join(' '),
        faucet.secret)
        .catch(console.error);
      break;
    case "privatekey":
      tezos.setProvider({
        signer: new InMemorySigner(value),
      });
      break;
    default:
      break;
  }
  const pkh = await tezos.signer.publicKeyHash();
  tezos.signer.secretKey().then(x => {
    saveAccount({ name: account, pkh: pkh, key: { kind: 'private_key', value: x } },
      x => { console.log(`Account ${pkh} is registered as '${account}'.`) });
  })
    .catch(console.error);
}

async function importFaucet(options) {
  importAccount("faucet", options);
}

async function importPrivatekey(options) {
  importAccount("privatekey", options);
}

async function showAccount(options) {
  const config = getConfig();
  const value = config.account;

  if (isNull(value)) {
    console.log("Error: no account is set.");
  } else {
    const account = getAccount(value);
    if (isNull(account)) {
      return console.log(`Error: ${account} is not found.`);
    }
    const tezos = getTezos();

    console.log(`Current account: ${account.name}`);
    console.log(`Public key hash: ${account.pkh}`);
    var balance = await tezos.tz.getBalance(account.pkh);
    console.log(`Balance on ${config.tezos.network}: ${balance.toNumber() / 1000000} ꜩ`);
  }
}

async function switchAccount(options) {
  const config = getConfig();
  if (!isNull(config.account)) {
    console.log(`Current account: ${config.account}`);
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
      saveConfig(config, x => { console.log("account updated") });
    })
    .catch(console.error);
}

async function setAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    return console.log(`Error: '${value}' is not found.`);
  }
  const config = getConfig();
  config.account = value;
  saveConfig(config, x => { console.log(`'${value}' is set as current account.`) });
}

async function removeAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    return console.log(`Error: '${value}' is not found.`);
  }

  const config = getConfig();
  if (config.account === value) {
    return console.log(`Error: cannot remove account '${value}' because it is currently set as the default account. Switch to another account before removing.`);
  }

  removeAccountInternal(value, x => { console.log(`'${value}' is removed.`) });
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
    console.log(`Error: '${from_raw}' is not found.`);
    return;
  }
  var accountTo = getAccountFromIdOrAddr(to_raw);
  if (isNull(accountTo) && !to_raw.startsWith('tz')) {
    console.log(`Error: '${to_raw}' bad account or address.`);
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

  console.log(`Transfering ${amount / 1000000} ꜩ from ${accountFrom.pkh} to ${to_addr}...`);
  tezos.contract
    .transfer({ to: to_addr, amount: amount, mutez: true })
    .then((op) => {
      console.log(`Waiting for ${op.hash} to be confirmed...`);
      return op.confirmation(1).then(() => op.hash);
    })
    .then((hash) => console.log(`Operation injected: ${network.tzstat_url}/${hash}`))
    .catch((error) => console.log(`Error: ${error} ${JSON.stringify(error, null, 2)}`));
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

async function copySource(arl, contract_name) {
  return new Promise(resolve => {
    fs.readFile(arl, 'utf8', (err, data) => {
      const source_path = sources_dir + '/' + contract_name + ".arl";
      fs.writeFile(source_path, data, (err) => {
        if (err) throw err;
        resolve(source_path);
      });
    });
  });
}

async function deploy(options) {
  const config = getConfig();

  const verbose = options.verbose;
  const arl = options.file;
  const as = options.as;
  const force = options.force;
  const named = options.named;
  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  const account = getAccountFromIdOrAddr(isNull(as) ? config.account : as);
  if (isNull(account)) {
    if (isNull(as)) {
      console.error(`Error: invalid account ${as}.`);
    } else {
      if (config.account === "") {
        console.error(`Error: account is not set.`);
      } else {
        console.error(`Error: invalid account ${config.account}.`);
      }
    }
    return;
  }

  const amount = isNull(options.amount) ? 0 : getAmount(options.amount);
  if (isNull(amount)) { return; };

  const contract_name = named === undefined ? path.basename(arl).split('.').slice(0, -1).join('.') : named;
  var confirm = await confirmContract(force, contract_name);
  if (!confirm) {
    return;
  }

  const contract_script = contracts_dir + '/' + contract_name + ".tz.js";
  {
    const res = await callArchetype(options, ['-t', 'javascript', arl]);

    fs.writeFile(contract_script, res, function (err) {
      if (err) throw err;
      if (verbose)
        console.log(`JS script for contract ${contract_name} is saved.`);
    });
  }

  const source = await copySource(arl, contract_name);
  const version = await getArchetypeVersion();

  var cont = await continueContract(force, contract_name, account, amount);
  if (!cont) {
    return;
  }

  const tezos = getTezos(account.name);

  var tzstorage = "";
  {
    const account = getAccount(config.account);
    const res = await callArchetype(options, ['-t', 'michelson-storage', '-sci', account.pkh, arl]);
    tzstorage = res;
    if (verbose)
      console.log(tzstorage);
  }

  {
    var c = require(contract_script);
    tezos.contract
      .originate({
        code: c.code,
        init: c.getStorage()
      })
      .then((originationOp) => {
        console.log(`Waiting for confirmation of origination for ${originationOp.contractAddress} ...`);
        return originationOp.contract();
      })
      .then((contract) => {
        saveContract({
          name: contract_name,
          address: contract.address,
          network: config.tezos.network,
          language: 'archetype',
          compiler_version: version,
          source: source
        },
          x => {
            console.log(`Origination completed for ${contract.address} named ${contract_name}.`);
            const url = network.bcd_url.replace('${address}', contract.address);
            console.log(url);
          });
      })
      .catch((error) => console.log(`Error: ${JSON.stringify(error, null, 2)}`));
  }
  return;
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

  const contract_id = options.contract;

  const as = isNull(options.as) ? config.account : options.as;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    console.log(`Error: account '${as}' is not found.`);
    return null;
  }

  const amount_raw = isNull(options.amount) ? '0tz' : options.amount;
  const amount = getAmount(amount_raw);
  if (isNull(amount)) {
    return;
  }

  var confirm = await confirmCall(force, account, contract_id, amount, entry, arg);
  if (!confirm) {
    return;
  }

  const tezos = getTezos(account.name);

  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  console.log(`Account '${account.pkh}' is calling ${entry} of ${contract_address} with ${amount / 1000000} ꜩ...`);

  tezos.contract
    .transfer({ to: contract_address, amount: amount, mutez: true, parameter: { entrypoint: entry, value: arg } })
    .then((op) => {
      console.log(`Waiting for ${op.hash} to be confirmed...`);
      return op.confirmation(1).then(() => op.hash);
    })
    .then((hash) => console.log(`Operation injected: ${network.tzstat_url}/${hash}`))
    .catch(
      error => {
        console.log({ ...error, errors: '...' });
      }
    );
}

async function getArg(options, contract_address, entry, callback) {
  retrieveContract(contract_address, path => {
    var args = [
      '--expr', options.with,
      '--with-contract', path,
      '--json'
    ];
    if (entry !== 'default') {
      if (entry.charAt(0) !== '%') {
        entry = "%" + entry;
      }
      args.push('--entrypoint', entry);
    }

    (async () => {
      const output_raw = await callArchetype(options, args);
      const output = output_raw.substring(0, output_raw.indexOf('}\n{') + 1);
      const res = JSON.parse(output);
      callback(res)
    })();
  });
}

async function callContract(options) {
  const input = options.contract;
  const arg = options.with;
  var entry = options.entry === undefined ? 'default' : options.entry;

  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      console.log(`Error: expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      console.log(`Error: '${contract_address}' unknown contract alias or bad contract address.`);
      return;
    }
  }

  if (arg !== undefined) {
    getArg(options, contract_address, entry, arg => { callTransfer(options, contract_address, arg) });
  } else {
    callTransfer(options, contract_address, { prim: "Unit" });
  }
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
  console.log(res);
}

async function showContracts(options) {
  const contracts = getContracts();

  contracts.contracts.forEach(x => {
    console.log(`${x.address}\t${x.network}\t${x.name}`);
  });
}

async function showContract(options) {
  const input = options.contract;

  var contract = getContractFromIdOrAddress(input);

  if (isNull(contract)) {
    console.log(`Error: contract '${input}' is not found.`);
    return;
  }

  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === contract.network);
  const url = network.bcd_url.replace('${address}', contract.address);

  console.log(`Name:     ${contract.name}`);
  console.log(`Network:  ${contract.network}`);
  console.log(`Address:  ${contract.address}`);
  console.log(`Source:   ${contract.source}`);
  console.log(`Language: ${contract.language}`);
  console.log(`Version:  ${contract.compiler_version}`);
  console.log(`Url:      ${url}`);
}

async function showEntries(options) {
  const input = options.contract;
  const contract = getContractFromIdOrAddress(input);

  var contract_address = input;
  if (!isNull(contract)) {
    const config = getConfig();
    if (contract.network !== config.tezos.network) {
      console.log(`Error: expecting network ${contract.network}. Switch endpoint and retry.`);
      return;
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      console.log(`Error: '${contract_address}' bad contract address.`);
      return;
    }
  }

  retrieveContract(contract_address, x => {
    (async () => {
      var args = ['--show-entries', '--json', x];
      const res = await callArchetype(options, args);
      console.log(res);
    })();
  });
}

async function removeContract(options) {
  const input = options.contract;

  var contract = getContractFromIdOrAddress(input);

  if (isNull(contract)) {
    console.log(`Error: contract '${input}' is not found.`);
    return;
  }

  var obj = getContracts();
  obj.contracts = obj.contracts.filter(x => { return (input !== x.name && input !== x.address) });
  saveFile(contracts_path, obj, x => { console.log(`contract '${contract.name}' is removed (${contract.address}).`) });
}

async function showUrl(options) {
  const name = options.contract;
  const c = getContract(name);
  if (isNull(c)) {
    console.log(`Error: contract '${name}' is not found.`);
    return;
  }
  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === config.tezos.network);
  const url = network.bcd_url.replace('${address}', c.address);
  console.log(url);
}

async function showSource(options) {
  const name = options.contract;
  const c = getContract(name);
  if (isNull(c)) {
    console.log(`Error: contract '${name}' is not found.`);
    return;
  }
  fs.readFile(c.source, 'utf8', (err, data) => {
    if (err) { throw err }
    console.log(data)
  });
}

async function commandNotFound(options) {
  console.log("commandNotFound: " + options.command);
  help(options);
  return 1;
}

export async function process(options) {
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
    case "import_faucet":
      importFaucet(options);
      break;
    case "import_privatekey":
      importPrivatekey(options);
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
      deploy(options);
      break;
    case "call_contract":
      callContract(options);
      break;
    case "generate_javascript":
      generateJavascript(options);
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
    default:
      commandNotFound(options);
  }

  return true;
}
