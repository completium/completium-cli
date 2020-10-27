import chalk from 'chalk';
import fs from 'fs';
import wget from 'node-wget';
import Listr from 'listr';
import execa from 'execa';

const completium_dir = '/tmp/.completium'
const bin_dir        = completium_dir + '/bin'
const bin_archetype  = bin_dir + '/archetype'
const bin_tezos      = bin_dir + "/tezos-client"

async function download(url, dest) {
  const request = wget({ url: url, dest: dest, timeout: 2000 });
  return request;
};

async function initCompletium(options) {

  if (!fs.existsSync(bin_dir)) {
    fs.mkdirSync(bin_dir);
  }

  const archetype_url   = "https://github.com/edukera/archetype-lang/releases/download/1.2.1/archetype-x64-linux";
  const tezosclient_url = "https://github.com/serokell/tezos-packaging/releases/latest/download/tezos-client";
  const a = await download(tezosclient_url, bin_tezos);
  const b = await download(archetype_url,   bin_archetype);
  fs.chmodSync(bin_archetype, '711');
  fs.chmodSync(bin_tezos,     '711');
  console.log("Completium initialized successfully!");
  return;
}

async function deploy(options) {
  const tz_sci = "tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg";
  // const arl = options.file;
  const arl = "/home/dev/archetype/archetype-lang/tests/passed/simple.arl";
  const contract_name = "simple";
  const contracts_dir = completium_dir + "/contracts";
  const contract_script = contracts_dir + contract_name + ".tz";
  const tezos_node = "testnet-tezos.giganode.io";
  const tezos_port = "443";

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
