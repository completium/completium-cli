import fs, { exists } from 'fs';
import wget from 'node-wget';
import execa from 'execa';
import path from 'path';
import { TezosToolkit } from '@taquito/taquito';
import { InMemorySigner, importKey } from '@taquito/signer';
import { isNumber } from 'util';
import { config } from 'process';

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
// const public_contracts_path = tezos_client_dir + '/contracts'
const config_path = completium_dir + '/config.json'
const accounts_path = completium_dir + '/accounts.json'
const contracts_path = completium_dir + '/contracts.json'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"

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

function saveFile(path, c, callback) {
  const content = JSON.stringify(c, null, 2);
  fs.writeFile(path, content, function (err) {
    if (err) return console.log(err);
    if (callback !== undefined) {
      callback();
    }
  });
}

function saveConfig(config, callback) {
  saveFile(config_path, config, callback);
}

function getContracts() {
  if (!fs.existsSync(contracts_path)) {
    saveFile(contracts_path, { contracts: [] });
  }
  var res = JSON.parse(fs.readFileSync(contracts_path, 'utf8'));
  return res;
}

function saveContract(c) {
  var obj = getContracts();
  obj.contracts.push(c);
  saveFile(contracts_path, obj);
}

function getContract(name) {
  var obj = getContracts();
  var c = obj.contracts.find(x => x.name === name);
  if (isNull(c)) { console.log(`'${name}' is not found in contracts.`) }
  return c;
}

function getAccounts() {
  if (!fs.existsSync(accounts_path)) {
    saveFile(accounts_path, { accounts: [] });
  }
  var res = JSON.parse(fs.readFileSync(accounts_path, 'utf8'));
  return res;
}

function saveAccount(c, callback) {
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

//////////////
// COMMANDS //
//////////////

async function help(options) {
  console.log("usage: [command] [options]")
  console.log("command:");
  console.log("  init")
  console.log("  help");
  console.log("  update binaries");

  console.log("  show endpoint");
  console.log("  switch endpoint");
  console.log("  add endpoint (main|edo|florence) <ENDPOINT_URL>");
  console.log("  remove endpoint [<ENDPOINT_URL>]");

  console.log("  import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]");
  console.log("  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]");

  console.log("  show account");
  console.log("  set account <ACCOUNT_ALIAS>");
  console.log("  switch account");
  console.log("  remove account <ACCOUNT_ALIAS>");

  console.log("  transfer <AMOUNT>(tz|utz) from <ACCOUNT_NAME|ACCOUNT_ADDRESS> to <ACCOUNT_NAME|ACCOUNT_ADDRESS> [--force]");
  console.log("  deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>] [--burn-cap <BURN_CAP>] [--init <PARAMETERS>] [--force]");
  console.log("  call <CONTRACT_NAME> [--as <ACCOUNT_NAME>] [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>] [--force]");
  console.log("  generate json <FILE.arl>");
  console.log("  show entries of <CONTRACT_ADDRESS>");

  console.log("  show contract <CONTRACT_NAME>");
  console.log("  remove contract <CONTRACT_NAME>");
  console.log("  show url <CONTRACT_NAME>");
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

  const config = {
    account: '',
    bin: {
      archetype: 'archetype'
    },
    tezos: {
      network: 'edo',
      endpoint: 'https://edonet-tezos.giganode.io',
      list: [
        {
          network: 'main',
          bcd_url: "https://better-call.dev/main/$address",
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
          bcd_url: "https://better-call.dev/edo2net/$address",
          tzstat_url: "https://edo.tzstats.com",
          endpoints: [
            'https://edonet-tezos.giganode.io',
            'https://edonet.smartpy.io'
          ]
        },
        {
          network: 'florence',
          bcd_url: "https://better-call.dev/florence/$address",
          tzstat_url: "https://florence.tzstats.com",
          endpoints: [
            'https://florence-tezos.giganode.io'
          ]
        }
      ]
    }
  };
  saveFile(config_path, config, (x => { console.log("Completium initialized successfully!") }));
}

async function updateBinaries(options) {
  const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.2/archetype-x64-linux";
  const path_archetype = bin_dir + '/archetype';
  await download(archetype_url, path_archetype);
  fs.chmodSync(path_archetype, '711');
  const config = getConfig();
  config.bin.archetype = path_archetype;
  saveConfig(config);
  console.log(`Binaries is updated`);
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
    return console.log(`Error: '${network}' is not found, expected: ${networks}`)
  }

  if (cnetwork.endpoints.includes(endpoint)) {
    return console.log(`Error: '${endpoint}' already registerd`)
  }

  cnetwork.endpoints.push(endpoint);

  config.tezos.list = config.tezos.list.map(x => x.network == network ? cnetwork : x);
  saveConfig(config, x => { console.log(`endpoint '${endpoint}' for network ${network} registered`) });
}

async function removeEndpoint(options) {
  const endpoint = options.endpoint;

  const config = getConfig();
  const l = config.tezos.list.map(x =>
  ({
    ...x,
    endpoints: x.endpoints.filter(e => { return (e !== endpoint) })
  })
  );

  config.tezos.list = l;
  saveConfig(config, x => { console.log(`configuration file updated`) });
}

async function confirmAccount(force, account) {
  if (force || isNull(getAccount(account))) { return true }

  const Confirm = require('prompt-confirm');

  const str = `${account} already exists, do you want to overwrite ?`;
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
      importKey(tezos,
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
  var pkh = await tezos.signer.publicKeyHash();
  tezos.signer.secretKey().then(x => {
    saveAccount({ name: account, pkh: pkh, key: { kind: 'private_key', value: x } },
      x => { console.log(`${account} saved.`) });
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
    console.log("Error: no account is set");
  } else {
    const account = getAccount(value);
    if (isNull(account)) {
      return console.log(`Error: ${account} not found, set another`);
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
    return console.log(`Error: '${value}' is not found`);
  }
  const config = getConfig();
  config.account = value;
  saveConfig(config, x => { console.log(`'${value}' is set as current account`) });
}

async function removeAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    return console.log(`Error: '${value}' is not found`);
  }

  const config = getConfig();
  if (config.account === value) {
    return console.log(`Error: cannot remove '${value}', this account is currently set as default account, please set another one before to do this.`);
  }

  removeAccountInternal(value, x => { console.log(`'${value}' is removed`) });
}

function getAmount(raw) {
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (isNull(v)) {
    console.error(`Error: ${raw} is invalid format for amount, expected, for example, 1tz or 2utz`);
    return null;
  }
  var value = Math.abs(v.str) * (v.utz ? 1 : 1000000);
  if (!Number.isInteger(value)) {
    console.log(`Error: ${raw} is a bad value, ${value} is not an integer.`);
    return null;
  }
  return value;
}

async function confirmTransfer(force, amount, from, to) {
  if (force) { return true }

  const config = getConfig();

  const Confirm = require('prompt-confirm');

  const str = `do you want to transfer: ${amount / 1000000} ꜩ from ${from.name} to ${to} on ${config.tezos.network} ?`;
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
    console.log(`Error: ${from_raw} is not found.`);
    return;
  }
  var accountTo = getAccountFromIdOrAddr(to_raw);
  if (isNull(accountTo) && !to_raw.startsWith('tz')) {
    console.log(`Error: ${to_raw} bad account or address.`);
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

///////////////
















// function getContracts() {
//   return JSON.parse(fs.readFileSync(public_contracts_path, 'utf8'));
// }

// function getContract(id) {
//   if (id.startsWith("KT1")) {
//     return id;
//   } else {
//     var value = '';
//     const contracts = getContracts();
//     // console.log(contracts);
//     contracts.forEach(x => { if (id === x.name) { value = x.value } })
//     if (value === '') {
//       console.log(`${id} contract is not found.`)
//     }
//     return value;
//   }
// }

// cli deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>] [--force]
async function deploy(options) {
  const verbose = options.verbose;
  const arl = options.file;
  const as = options.as;
  const force = options.force;
  const named = options.named;
  const contract_name = named === undefined ? path.basename(arl) : named;
  const config = getConfig();
  var a = getContract(contract_name);
  if (a != null) {
    console.log(`${contract_name} already exists, do you want to replace it ? [y/N]`);
    return;
  }
  const contract_script = contracts_dir + '/' + contract_name + ".tz.js";

  {
    const res = await callArchetype(options, ['-t', 'javascript', arl]);

    fs.writeFile(contract_script, res, function (err) {
      if (err) throw err;
      if (verbose)
        console.log('Contract js script saved!');
    });
  }

  var tzstorage = "";
  {
    // const res = await callArchetype(options, ['-t', 'michelson-storage', '-sci', tz_sci, arl]);
    const res = await callArchetype(options, ['-t', 'michelson-storage', arl]);
    tzstorage = res;
    if (verbose)
      console.log(tzstorage);
  }

  {
    const tezos = getTezos();
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
        console.log(`Origination completed for ${contract.address}.`);
        saveContract({ name: contract_name, address: contract.address, network: config.tezos.network });
      })
      .catch((error) => console.log(`Error: ${JSON.stringify(error, null, 2)}`));
  }
  return;
}

function createScript(id, content, callback) {
  const path = scripts_dir + '/' + id + '.json';
  fs.writeFile(path, content, function (err) {
    if (err) throw err;
    callback(path);
  });
}

function retrieveContract(contract, callback) {
  var config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  const url = tezos_endpoint + '/chains/main/blocks/head/context/contracts/' + contract + '/script';

  var request = require('request');
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      createScript(contract, body, callback);
    }
    else {
      console.log("Error " + response.statusCode)
    }
  })
}

async function callTezosTransfer(options, arg) {
  const as = options.as;
  const account = getAccount(as);

  if (!isNull(account)) {
    const contract = options.contract;
    var entry = options.entry === undefined ? 'default' : options.entry;

    const amount = options.amount === undefined ? '0' : options.amount;
    const burnCap = options.burnCap === undefined ? '20' : options.burnCap;

    if (entry !== undefined && entry.startsWith('%')) {
      entry = entry.substring(1);
    }

    var args = [
      'transfer', amount,
      'from', account,
      'to', getContract(contract),
      '--entrypoint', entry,
      '--arg', arg,
      '--burn-cap', burnCap
    ];
    callTezosClient(options, args);
  }
}

async function getArg(options, callback) {
  const contract = getContract(options.contract);
  var entry = options.entry === undefined ? 'default' : options.entry;

  retrieveContract(contract, path => {
    var args = [
      '--expr', options.with,
      '--with-contract', path
    ];
    if (entry !== 'default') {
      if (entry.charAt(0) !== '%') {
        entry = "%" + entry;
      }
      args.push('--entrypoint', entry);
    }

    (async () => {
      const res = await callArchetype(options, args);
      callback(res)
    })();
  });
}

// cli call <CONTRACT_NAME> as <ACCOUNT_NAME> [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>] [--dry]
async function callContract(options) {
  const arg = options.with === undefined ? 'Unit' : options.with;

  if (arg !== 'Unit') {
    getArg(options, arg => { callTezosTransfer(options, arg) });
  } else {
    callTezosTransfer(options, arg)
  }
}

async function generateJson(options) {
  const x = options.path;

  var args = ['--json', '--only-code', x];
  const res = await callArchetype(options, args);
  console.log(res);
}
async function showEntriesOf(options) {
  const contract = options.contract;
  retrieveContract(contract, x => {
    (async () => {
      var args = ['--show-entries', '--json', x];
      const res = await callArchetype(options, args);
      console.log(res);
    })();
  });
}

async function removeContract(options) {
  const account = options.account;

  var args = ['forget', 'contract', account];
  callTezosClient(options, args);
}

async function showUrl(options) {
  const name = options.contract;
  const config = getConfig();
  const c = getContract(name);
  const n = config.tezos.list.find(x => x.network === config.tezos.network);
  const url = n.bcd_url.replace('$address', c.address);
  console.log(url);
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
    case "update_binaries":
      updateBinaries(options);
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
    case "generate_json":
      generateJson(options);
      break;
    case "show_entries_of":
      showEntriesOf(options);
      break;
    case "show_contract":
      showContract(options);
      break;
    case "remove_contract":
      removeContract(options);
      break;
    case "show_url":
      showUrl(options);
      break;
    default:
      commandNotFound(options);
  }

  // console.log('%s Project ready', chalk.green.bold('DONE'));
  return true;
}

// const tasks = new Listr([
//   {
//     title: 'Display help',
//     task: () => help(options),
//     enabled: () => options.command === "help",
//   },
//   {
//     title: 'Initialize completium',
//     task: () => initCompletium(options),
//     enabled: () => options.command === "init",
//   },
//   {
//     title: 'Generate account',
//     task: () => generateAccount(options),
//     enabled: () => options.command === "generate_account",
//   },
//   {
//     title: 'Transfer',
//     task: () => transfer(options),
//     enabled: () => options.command === "transfer",
//   },
//   {
//     title: 'Remove',
//     task: () => removeAccount(options),
//     enabled: () => options.command === "remove",
//   },
//   {
//     title: 'Show account',
//     task: () => showAccount(options),
//     enabled: () => options.command === "show_account",
//   },
//   {
//     title: 'Deployment from archetype file',
//     task: () => deploy(options),
//     enabled: () => options.command === "deploy",
//   },
//   {
//     title: 'Set property value',
//     task: () => configSet(options),
//     enabled: () => options.command === "config_set",
//   },
//   {
//     title: 'Set property value',
//     task: () => configSet(options),
//     enabled: () => options.command === "config_set",
//   },
//   {
//     title: 'Show entries of a contract',
//     task: () => showEntries(options),
//     enabled: () => options.command === "show_entries_of",
//   }
// ]);

// await tasks.run();
