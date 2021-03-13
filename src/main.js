import chalk from 'chalk';
import fs from 'fs';
import wget from 'node-wget';
import Listr from 'listr';
import execa from 'execa';
import path from 'path';
import { rejects } from 'assert';

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const tezos_client_dir = homedir + '/.tezos-client'
const public_key_hashs_path = tezos_client_dir + '/public_key_hashs'
const public_contracts_path = tezos_client_dir + '/contracts'
const config_path = completium_dir + '/config.json'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"


async function download(url, dest) {
  const request = wget({ url: url, dest: dest, timeout: 2000 });
  return request;
};

function getConfig() {
  return JSON.parse(fs.readFileSync(config_path, 'utf8'));
}

function saveConfig(config) {
  const content = JSON.stringify(config);
  fs.writeFile(config_path, content, function (err) {
    if (err) return console.log(err);
    console.log("Configuration file is updated");
  });
}

async function help(options) {
  // FIXME
  console.log("usage: [command] [options]")
  console.log("command:");
  console.log("  init")
  console.log("  help");
  console.log("  update binaries");
  console.log("  generate account <ACCOUNT_NAME> [--from-faucet <FAUCET_FILE>]");
  console.log("  transfer <AMOUNT> from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_NAME>");
  console.log("  remove account <ACCOUNT_NAME>");
  console.log("  remove contract <CONTRACT_NAME>");
  console.log("  deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>] [--burn-cap <BURN_CAP>] [--init <PARAMETERS>] [--force]");
  console.log("  call <CONTRACT_NAME> as <ACCOUNT_NAME> [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>] [--dry]");
  console.log("  generate json <FILE.arl>");
  console.log("  show entries of <CONTRACT_ADDRESS>");
  console.log("  show endpoint");
  console.log("  switch endpoint");
  console.log("  show account");
  console.log("  set account <ACCOUNT_NAME>");
  console.log("  switch account");
  console.log("  show contract <CONTRACT_ID>");
}

function isNull(str) {
  return str === undefined || str === null || str === "";
}

function getAccount(forceAccount) {
  const config = getConfig();
  const account = config.account;
  if (isNull(forceAccount) && isNull(account)) {
    console.log("Cannot exectute this command, please generate an account first.");
  }
  return isNull(forceAccount) ? account : forceAccount;
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

  // const { promisify } = require('util');

  const config = {
    account: '',
    bin: {
      archetype: 'archetype',
      tezosclient: 'tezos-client'
    },
    tezos: {
      network: 'edo',
      endpoint: 'https://edonet-tezos.giganode.io:443',
      list: [
        {
          network: 'main',
          endpoint: 'https://mainnet-tezos.giganode.io:443'
        },
        {
          network: 'edo',
          endpoint: 'https://edonet-tezos.giganode.io:443'
        },
        {
          network: 'florence',
          endpoint: 'https://florence-tezos.giganode.io:443'
        }
      ]
    }
  };

  const content = JSON.stringify(config);
  fs.writeFile(config_path, content, function (err) {
    if (err) return console.log(err);
    console.log("Completium initialized successfully!");
  });
}

async function updateBinaries(options) {
  const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.2/archetype-x64-linux";
  const tezosclient_url = "https://github.com/serokell/tezos-packaging/releases/latest/download/tezos-client";
  const path_tezosclient = bin_dir + '/tezos-client';
  const path_archetype = bin_dir + '/archetype';
  await download(tezosclient_url, path_tezosclient);
  await download(archetype_url, path_archetype);
  fs.chmodSync(path_tezosclient, '711');
  fs.chmodSync(path_archetype, '711');
  const config = getConfig();
  config.bin.tezosclient = path_tezosclient;
  config.bin.archetype = path_archetype;
  saveConfig(config);
  console.log(`Binaries is updated`);
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

async function callTezosClient(options, args) {
  const config = getConfig();
  const bin_tezos = config.bin.tezosclient;
  const tezos_endpoint = config.tezos.endpoint;

  const dry = options.dry;
  const force = options.force;

  const verbose = options.verbose;

  var args = ['--endpoint', tezos_endpoint].concat(args);
  if (dry) {
    args.push('-D')
  }
  if (force) {
    args.push('--force')
  }

  if (verbose) {
    console.log(bin_tezos + ' ' + args)
  }
  const { stdout } = await execa(bin_tezos, args, {});
  console.log(stdout);
}

// cli generate account <ACCOUNT_NAME> [--from-faucet <FAUCET_FILE>]
async function generateAccount(options) {
  const account = options.account;
  const fromFaucet = options.fromFaucet;

  var args = [];
  if (fromFaucet !== undefined) {
    args = ['activate', 'account', account, 'with', fromFaucet];
  } else {
    args = ['gen', 'keys', account];
  }

  callTezosClient(options, args);
}

function getContracts() {
  return JSON.parse(fs.readFileSync(public_contracts_path, 'utf8'));
}

function getContract(id) {
  if (id.startsWith("KT1")) {
    return id;
  } else {
    var value = '';
    const contracts = getContracts();
    // console.log(contracts);
    contracts.forEach(x => { if (id === x.name) { value = x.value } })
    if (value === '') {
      console.log(`${id} contract is not found.`)
    }
    return value;
  }
}

// cli transfer <AMOUNT> from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_NAME>
async function transfer(options) {
  const amount = options.vamount;
  const from = options.from;
  const to = options.to;

  var args = [
    'transfer', amount,
    'from', from,
    'to', getContract(to),
  ];
  callTezosClient(options, args)
    .then(
      x => {

      }
    );
}

// cli remove <ACCOUNT_NAME|CONTRACT_NAME>
async function removeAccount(options) {
  const account = options.account;

  var args = ['forget', 'address', account];
  callTezosClient(options, args);
}

// cli remove contract <ACCOUNT_NAME|CONTRACT_NAME>
async function removeContract(options) {
  const account = options.account;

  var args = ['forget', 'contract', account];
  callTezosClient(options, args);
}

// cli deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>] [--force]
async function deploy(options) {
  const verbose = options.verbose;
  const arl = options.file;
  const as = options.as;
  const tz_sci = getAccount(as);
  if (!isNull(tz_sci)) {
    const named = options.named;
    const contract_name = named === undefined ? path.basename(arl) : named;
    const contract_script = contracts_dir + '/' + contract_name + ".tz";

    {
      const res = await callArchetype(options, [arl]);

      fs.writeFile(contract_script, res, function (err) {
        if (err) throw err;
        if (verbose)
          console.log('Contract script saved!');
      });
    }

    var tzstorage = "";
    {
      const res = await callArchetype(options, ['-t', 'michelson-storage', '-sci', tz_sci, arl]);
      tzstorage = res;
      if (verbose)
        console.log(tzstorage);
    }

    {
      const amount = options.amount === undefined ? '0' : options.amount;
      const burnCap = options.burnCap === undefined ? '20' : options.burnCap;

      const args = ['originate', 'contract', contract_name,
        'transferring', amount,
        'from', tz_sci,
        'running', contract_script,
        '--init', tzstorage,
        '--burn-cap', burnCap];
      callTezosClient(options, args);
    }
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
  const account = getAccount(options.account);
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
  const entry = options.entry === undefined ? 'default' : options.entry;

  retrieveContract(contract, path => {
    var args = [
      '--expr', options.with,
      '--with-contract', path
    ];
    if (entry !== 'default') {
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

async function showEntries(options) {
  const contract = options.contract;
  retrieveContract(contract, x => {
    (async () => {
      var args = ['--show-entries', '--json', x];
      const res = await callArchetype(options, args);
      console.log(res);
    })();
  });
}

async function showEndpoint(options) {
  var config = getConfig();
  console.log("Current network: " + config.tezos.network);
  console.log("Current endpoint: " + config.tezos.endpoint);
}

async function switchEndpoint(options) {
  showEndpoint(options);

  var config = getConfig();

  const answers = config.tezos.list.map(x => { return `${x.network.padEnd(10)} ${x.endpoint}` });
  const answers2 = config.tezos.list.map(x => { return `${x.network.padEnd(10)} ${x.endpoint}` });
  const networks = config.tezos.list.map(x => { return x.network });
  const endpoints = config.tezos.list.map(x => { return x.endpoint });

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch endpoint',
    choices: answers,
  });

  prompt.run()
    .then(answer => {
      var i = answers2.indexOf(answer);

      const config = getConfig();
      config.tezos.network = networks[i];
      config.tezos.endpoint = endpoints[i];
      saveConfig(config);
    })
    .catch(console.error);
}

function getKeyHashs() {
  return JSON.parse(fs.readFileSync(public_key_hashs_path, 'utf8'));
}

async function showAccount(options) {
  const config = getConfig();
  const value = config.account;

  if (isNull(value)) {
    console.log("No account is set");
  } else {
    const keyHashs = getKeyHashs();
    var name = '';
    keyHashs.forEach(x => { if (value === x.value) { name = x.name } })
    console.log(`Current account: ${name} ${value}`);
  }
}

async function switchAccount(options) {
  showAccount(options);

  const keyHashs = getKeyHashs();
  const answers = keyHashs.map(x => { return `${x.name.padEnd(60)} ${x.value}` });
  const answers2 = keyHashs.map(x => { return `${x.name.padEnd(60)} ${x.value}` });
  const values = keyHashs.map(x => { return x.value });

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch account',
    choices: answers,
  });

  prompt.run()
    .then(answer => {
      var i = answers2.indexOf(answer);
      const value = values[i];
      const config = getConfig();
      config.account = value;
      saveConfig(config);
    })
    .catch(console.error);
}

async function setAccount(options) {
  const account = options.account;
  const keyHashs = getKeyHashs();
  var value = "";
  keyHashs.forEach(x => {
    if (x.value === account) {
      value = x.value;
    } else if (x.name === account && isNull(value)) {
      value = x.value;
    }
  });
  if (isNull(value)) {
    console.log(`${account} is not found`)
  } else {
    const config = getConfig();
    config.account = value;
    saveConfig(config);
  }
}

async function showContract(options) {
  const contract = options.contract;

  var args = ['show', 'known', 'contract', contract];
  callTezosClient(options, args);
}

async function commandNotFound(options) {
  console.log("commandNotFound: " + options.command);
  help(options);
  return 1;
}

export async function process(options) {
  switch (options.command) {
    case "help":
      help(options);
      break;
    case "init":
      initCompletium(options);
      break;
    case "update_binaries":
      updateBinaries(options);
      break;
    case "generate_account":
      generateAccount(options);
      break;
    case "transfer":
      transfer(options);
      break;
    case "remove_account":
      removeAccount(options);
      break;
    case "remove_contract":
      removeContract(options);
      break;
    case "show_account":
      showAccount(options);
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
    case "config_set":
      configSet(options);
      break;
    case "show_entries_of":
      showEntries(options);
      break;
    case "show_endpoint":
      showEndpoint(options);
      break;
    case "switch_endpoint":
      switchEndpoint(options);
      break;
    case "show_account":
      showAccount(options);
      break;
    case "switch_account":
      switchAccount(options);
      break;
    case "set_account":
      setAccount(options);
      break;
    case "show_contract":
      showContract(options);
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
