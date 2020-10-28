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
const bin_archetype = bin_dir + '/archetype'
const bin_tezos = bin_dir + "/tezos-client"

const properties_account = "account"
const properties_tezos_node = "tezos.node"
const properties_tezos_port = "tezos.port"

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

async function initCompletium(options) {

  if (!fs.existsSync(bin_dir)) {
    fs.mkdirSync(bin_dir, { recursive: true });
  }

  if (!fs.existsSync(contracts_dir)) {
    fs.mkdirSync(contracts_dir, { recursive: true });
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

async function deploy(options) {
  // const arl = options.file;
  const arl = "/home/dev/archetype/archetype-lang/tests/passed/simple.arl";
  const tz_sci = getConfig(properties_account);
  const contract_name = path.basename(arl);
  const contract_script = contracts_dir + contract_name + ".tz";
  const tezos_node = getConfig(properties_tezos_node);
  const tezos_port = getConfig(properties_tezos_port);

  {
    const { stdout } = await execa(bin_archetype, [arl], {});
    console.log(stdout);

    fs.writeFile(contract_script, stdout, function (err) {
      if (err) throw err;
      console.log('Contract script saved!');
    });
  }

  var tzstorage = "";
  {
    const { stdout } = await execa(bin_archetype, ['-t', 'michelson-storage', '-sci', tz_sci, arl], {});
    tzstorage = stdout;
    console.log(tzstorage);
  }

  {
    const { stdout } = await execa(bin_tezos,
      ['-S', '-A', tezos_node,
        '-P', tezos_port,
        'originate', 'contract', contract_name,
        'transferring', '0',
        'from', tz_sci,
        'running', contract_script,
        '--init', tzstorage,
        '--burn-cap', '20',
        '--force',
        '-D'
      ], {});
    console.log(stdout);
  }

  return;
}


export async function process(options) {

  const tasks = new Listr([
    {
      title: 'Initialize completium',
      task: () => initCompletium(options),
      enabled: () => options.init,
    },
    {
      title: 'Deployment from archetype file',
      task: () => deploy(options),
      enabled: () => options.deploy,
    }
  ]);

  await tasks.run();
  // console.log('%s Project ready', chalk.green.bold('DONE'));
  return true;
}
