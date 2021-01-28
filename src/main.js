import chalk from 'chalk';
import fs from 'fs';
import wget from 'node-wget';
import Listr from 'listr';
import execa from 'execa';
import propertiesReader from 'properties-reader';
import path from 'path';
import { rejects } from 'assert';

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const tezos_client_dir = homedir + '/.tezos-client'
const public_key_hashs_path = tezos_client_dir + '/public_key_hashs'
const config_path = completium_dir + '/config'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"
// const bin_archetype = bin_dir + '/archetype'
const bin_archetype = 'archetype'
//const bin_tezos = bin_dir + "/tezos-client"
const bin_tezos = "tezos-client"

const properties_account = "account"
const properties_tezos_endpoint = "tezos.endpoint"

const properties_network = "tezos.network"
const properties_networks = "tezos.networks"

const properties_endpoint_main = "endpoint.main"
const properties_endpoint_delphi = "endpoint.delphi"
const properties_endpoint_edo = "endpoint.edo"


const properties = [
  properties_account,
  properties_tezos_endpoint
]

async function download(url, dest) {
  const request = wget({ url: url, dest: dest, timeout: 2000 });
  return request;
};

var config

function getConfig(p) {
  if (config === undefined) {
    config = propertiesReader(config_path);
  }
  return config.get(p)
}

async function help(options) {
  // FIXME
  console.log("usage: [command] [options]")
  console.log("command:");
  console.log("  init")
  console.log("  help");
  console.log("  generate account <ACCOUNT_NAME> [--from-faucet <FAUCET_FILE>]");
  console.log("  transfer <AMOUNT> from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_NAME>");
  console.log("  remove <ACCOUNT_NAME|CONTRACT_NAME>");
  console.log("  list accounts");
  console.log("  deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>] [--burn-cap <BURN_CAP>] [--force]");
  console.log("  call <CONTRACT_NAME> as <ACCOUNT_NAME> [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>] [--dry]");
  console.log("  generate json <FILE.arl>");
  console.log("  config set <property> <value>");
  console.log("  show entries of <CONTRACT_ADDRESS>");
  console.log("  show network");
  console.log("  switch network");
  console.log("  show account");
  console.log("  switch account");
}

function isNull(str) {
  return str === undefined || str === null || str === "";
}

function getAccount(forceAccount) {
  const account = getConfig(properties_account);
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

  const { promisify } = require('util');

  const writeFileAsync = promisify(fs.writeFile);
  await writeFileAsync(config_path, '');
  var vconfig = propertiesReader(config_path);
  vconfig.set(properties_tezos_endpoint, 'https://delphinet-tezos.giganode.io:443');
  vconfig.set(properties_network, 'delphi');
  vconfig.set(properties_networks, 'main,delphi,edo');
  vconfig.set(properties_endpoint_main, 'https://mainnet-tezos.giganode.io:443');
  vconfig.set(properties_endpoint_delphi, 'https://delphinet-tezos.giganode.io:443');
  vconfig.set(properties_endpoint_edo, 'https://edonet-tezos.giganode.io:443');
  await vconfig.save(config_path);

  // const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.1/archetype-x64-linux";
  // const tezosclient_url = "https://github.com/serokell/tezos-packaging/releases/latest/download/tezos-client";
  // await download(tezosclient_url, bin_tezos);
  // await download(archetype_url, bin_archetype);
  // fs.chmodSync(bin_archetype, '711');
  // fs.chmodSync(bin_tezos, '711');
  console.log("Completium initialized successfully!");
  return;
}

async function callArchetype(options, args) {
  const verbose = options.verbose;

  try {
    const { stdout } = await execa(bin_archetype, args, {});
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
  const tezos_endpoint = getConfig(properties_tezos_endpoint);

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

// cli transfer <AMOUNT> from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_NAME>
async function transfer(options) {
  const amount = options.vamount;
  const from = options.from;
  const to = options.to;

  var args = [
    'transfer', amount,
    'from', from,
    'to', to,
  ];
  callTezosClient(options, args)
    .then(
      x => {
        const account = getConfig(properties_account);
        if (isNull(account)) {
          var vconfig = propertiesReader(config_path);
          vconfig.set(properties_account, account);
          vconfig.save(config_path);
        }
      }
    );
}

// cli remove <ACCOUNT_NAME|CONTRACT_NAME>
async function removeAccount(options) {
  const account = options.account;

  var args = ['forget', 'address', account];
  callTezosClient(options, args);
}

// cli list accounts
async function listAccounts(options) {
  var args = ['list', 'known', 'addresses'];

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
  const tezos_endpoint = getConfig(properties_tezos_endpoint);
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
      'to', contract,
      '--entrypoint', entry,
      '--arg', arg,
      '--burn-cap', burnCap
    ];
    callTezosClient(options, args);
  }
}

async function getArg(options, callback) {
  const contract = options.contract;
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

async function showNetwork(options) {
  const network = getConfig(properties_network);
  console.log("Current network: " + network);
}

async function switchNetwork(options) {
  showNetwork(options);

  const networks = getConfig(properties_networks).split(',').map(x => x.trim());

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch network',
    choices: networks,
  });

  prompt.run()
    .then(answer => {
      var vconfig = propertiesReader(config_path);
      vconfig.set(properties_network, answer);
      vconfig.set(properties_tezos_node, getConfig("node." + answer));
      vconfig.save(config_path);
    })
    .catch(console.error);
}

async function showAccount(options) {
  const value = getConfig(properties_account);

  if (isNull(value)) {
    console.log("No account is set");
  } else {
    console.log("Current account: " + value);
  }
}

async function switchAccount(options) {
  showAccount(options);

  const keyHashs = JSON.parse(fs.readFileSync(public_key_hashs_path, 'utf8'));
  const answers  = keyHashs.map(x => { return `${x.name.padEnd(60)} ${x.value}` });
  const answers2 = keyHashs.map(x => { return `${x.name.padEnd(60)} ${x.value}` });
  const values   = keyHashs.map(x => { return x.value });

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: 'Switch account',
    choices: answers,
  });

  prompt.run()
    .then(answer => {
      console.log(answers2);
      console.log(answer);
      var i = answers2.indexOf(answer);
      console.log(i);
      const value = values[i];
      console.log(value);
    })
    .catch(console.error);
}

async function configSet(options) {
  const property = options.property;
  const value = options.value;

  var found = false;
  properties.forEach(p => found |= p === property);
  if (!found) {
    // console.error.log('Property "' + property + '" is not found');
    return;
  }

  var vconfig = propertiesReader(config_path);
  vconfig.set(property, value);
  await vconfig.save(config_path);
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
    case "generate_account":
      generateAccount(options);
      break;
    case "transfer":
      transfer(options);
      break;
    case "remove":
      removeAccount(options);
      break;
    case "show_account":
      showAccount(options);
      break;
    case "list_accounts":
      listAccounts(options);
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
    case "show_network":
      showNetwork(options);
      break;
    case "switch_network":
      switchNetwork(options);
      break;
    case "show_account":
      showAccount(options);
      break;
    case "switch_account":
      switchAccount(options);
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
