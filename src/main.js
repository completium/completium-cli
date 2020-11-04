import chalk from 'chalk';
import fs from 'fs';
import wget from 'node-wget';
import Listr from 'listr';
import execa from 'execa';
import propertiesReader from 'properties-reader';
import path from 'path';

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const config_path = completium_dir + '/config'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"
// const bin_archetype = bin_dir + '/archetype'
const bin_archetype = 'archetype'
const bin_tezos = bin_dir + "/tezos-client"

const properties_account = "account"
const properties_tezos_node = "tezos.node"
const properties_tezos_port = "tezos.port"

const properties = [
  properties_account,
  properties_tezos_node,
  properties_tezos_port
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
  console.log("generateAccount: help");
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
  vconfig.set(properties_account, 'tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg');
  vconfig.set(properties_tezos_node, 'testnet-tezos.giganode.io');
  vconfig.set(properties_tezos_port, '443');
  await vconfig.save(config_path);

  const archetype_url = "https://github.com/edukera/archetype-lang/releases/download/1.2.1/archetype-x64-linux";
  const tezosclient_url = "https://github.com/serokell/tezos-packaging/releases/latest/download/tezos-client";
  await download(tezosclient_url, bin_tezos);
  await download(archetype_url, bin_archetype);
  fs.chmodSync(bin_archetype, '711');
  fs.chmodSync(bin_tezos, '711');
  console.log("Completium initialized successfully!");
  return;
}

// cli generate account <ACCOUNTNAME> [from faucet <FAUCETFILE>]
async function generateAccount(options) {
  // FIXME
  console.log("generateAccount: TODO");
}

// cli transfer <AMOUNT> from <ACCOUNTNAME> to <ACCOUNTNAME> [dry]
async function transfer(options) {
  const tezos_node = getConfig(properties_tezos_node);
  const tezos_port = getConfig(properties_tezos_port);
  const amount = options.amount;
  const from = options.from;
  const to = options.to;
  const dry = options.dry;

  var args = ['-S', '-A', tezos_node,
    '-P', tezos_port,
    'transfer', amount,
    'from', from,
    'to', to,
  ];
  if (dry) {
    args.push('-D')
  }

  const { stdout } = await execa(bin_tezos, args, {});
  console.log(stdout);
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

// cli remove <ACCOUNTNAME|CONTRACTNAME>
async function removeAccount(options) {
  // FIXME
  console.log("removeAccount: TODO");
}

// cli show account <ACCOUNTNAME> [with secret]
async function showAccount(options) {
  // FIXME
  console.log("showAccount: TODO");
}

// cli deploy <FILE.arl> [as <ACCOUNTNAME>] [named <CONTRACTNAME>] [force]
async function deploy(options) {
  const verbose = options.verbose;
  const arl = options.deployfile;
  const tz_sci = getConfig(properties_account);
  const contract_name = path.basename(arl);
  const contract_script = contracts_dir + contract_name + ".tz";
  const tezos_node = getConfig(properties_tezos_node);
  const tezos_port = getConfig(properties_tezos_port);
  const dry = options.dry;

  {
    const { stdout } = await execa(bin_archetype, [arl], {});
    if (verbose)
      console.log(stdout);

    fs.writeFile(contract_script, stdout, function (err) {
      if (err) throw err;
      if (verbose)
        console.log('Contract script saved!');
    });
  }

  var tzstorage = "";
  {
    const { stdout } = await execa(bin_archetype, ['-t', 'michelson-storage', '-sci', tz_sci, arl], {});
    tzstorage = stdout;
    if (verbose)
      console.log(tzstorage);
  }

  {
    var args = ['-S', '-A', tezos_node,
      '-P', tezos_port,
      'originate', 'contract', contract_name,
      'transferring', '0',
      'from', tz_sci,
      'running', contract_script,
      '--init', tzstorage,
      '--burn-cap', '20',
      '--force'
    ];
    if (dry) {
      args.push('-D')
    }

    const { stdout } = await execa(bin_tezos, args, {});
    console.log(stdout);
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
  const tezos_node = getConfig(properties_tezos_node);
  const tezos_port = getConfig(properties_tezos_port);
  const url = 'https://' + tezos_node + ':' + tezos_port + '/chains/main/blocks/head/context/contracts/' + contract + '/script';

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

// cli call <CONTRACTNAME> as <ACCOUNTNAME> [entry <ENTRYNAME>] [with <ARG>] [dry]
async function callContract(options) {
  // FIXME
}

async function showEntries(options) {
  const contract = options.contract;
  retrieveContract(contract, x => {
    (async () => {
      const { stdout } = await execa(bin_archetype, ['--show-entries', '--json', x], {});
      console.log(stdout);
    })();
  });
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
    case "deploy":
      deploy(options);
      break;
    case "config_set":
      configSet(options);
      break;
    case "show_entries_of":
      showEntries(options);
      break;
    default:
      commandNotFound(options);
  }

  // console.log('%s Project ready', chalk.green.bold('DONE'));
  return true;
}
