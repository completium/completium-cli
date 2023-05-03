/*!
 * completium-cli <https://github.com/completium/completium-cli>
 *
 * Copyright (c) 2021-2023, edukera, SAS.
 * Released under the MIT License.
 */

const fs = require('fs');
const execa = require('execa');
const path = require('path');
const glob = require('glob');
const taquito = require('@taquito/taquito');
const taquitoUtils = require('@taquito/utils');
const binderTs = require('@completium/archetype-binder-ts');
const codec = require('@taquito/michel-codec');
const encoder = require('@taquito/michelson-encoder');
const bip39 = require('bip39');
const signer = require('@taquito/signer');
const { BigNumber } = require('bignumber.js');
const { Fraction } = require('fractional');
let archetype = null;

const version = '0.4.78'

const homedir = require('os').homedir();
const completium_dir = homedir + '/.completium'
const config_path = completium_dir + '/config.json'
const accounts_path = completium_dir + '/accounts.json'
const contracts_path = completium_dir + '/contracts.json'
const mockup_conf_path = completium_dir + '/mockup.conf.json'
const log_path = completium_dir + '/log.json'
const bin_dir = completium_dir + '/bin'
const contracts_dir = completium_dir + "/contracts"
const scripts_dir = completium_dir + "/scripts"
const sources_dir = completium_dir + "/sources"

const docker_id = 'oxheadalpha/flextesa:latest'
const flextesa_script = 'mumbaibox'

var config = null;
const mockup_path = completium_dir + "/mockup";
const context_mockup_path = completium_dir + "/mockup/mockup/context.json";

const tezos_client_dir = homedir + '/.tezos-client'

//const default_mockup_protocol = ''
const default_mockup_protocol = 'PtMumbai2TmsJHNGRkD8v8YDbtao7BLUC3wjASn1inAKLFCjaH1'

const import_endpoint = 'https://ghostnet.ecadinfra.com'; // used for import faucet

///////////
// TOOLS //
///////////

let settings_quiet = false

function print(msg) {
  if (!settings_quiet)
    console.log(msg);
}

function print_error(msg) {
  if (!settings_quiet)
    console.error(msg);
}

function loadJS(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function getConfig() {
  if (config == null)
    config = loadJS(config_path);
  return config;
}

function getMockupConfig() {
  let mockup_config = {};
  if (fs.existsSync(mockup_conf_path)) {
    mockup_config = loadJS(mockup_conf_path);
  }
  return mockup_config;
}

function saveFile(path, c, callback) {
  const content = JSON.stringify(c, null, 2);
  fs.writeFileSync(path, content);
  if (callback !== undefined) {
    callback();
  }
}

function saveConfig(config, callback) {
  saveFile(config_path, config, callback);
}

function saveMockupConfig(config, callback) {
  saveFile(mockup_conf_path, config, callback);
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
  const config = getConfig();

  const metadata_storage = options.metadata_storage ? options.metadata_storage : (settings ? settings.metadata_storage : undefined);
  const metadata_uri = options.metadata_uri ? options.metadata_uri : (settings ? settings.metadata_uri : undefined);
  const otest = options.test || (settings !== undefined && settings.test_mode);
  const compiler_json = options.compiler_json ? true : false;

  return {
    ...settings,
    "test_mode": otest,
    "metadata_storage": metadata_storage,
    "metadata_uri": metadata_uri,
    "json": compiler_json,
  }
}

function computeArgsSettings(options, settings, path) {
  const args = []
  if (settings.version) {
    args.push('--version')
  } else {
    if (settings.with_parameters) {
      args.push('--with-parameters')
    } else {
      if (settings.target) {
        args.push('--target');
        args.push(settings.target);
      }
      if (settings.contract_interface) {
        args.push('--show-contract-interface');
      }
      if (settings.contract_interface_michelson) {
        args.push('--show-contract-interface-michelson');
      }
      if (settings.sci) {
        args.push('--set-caller-init');
        args.push(settings.sci);
      }
      if (settings.get_storage_values) {
        args.push('--get-storage-values')
      }

      if (options.metadata_storage) {
        args.push('--metadata-storage');
        args.push(options.metadata_storage);
      } else if (settings.metadata_storage) {
        args.push('--metadata-storage');
        args.push(settings.metadata_storage);
      }

      if (options.metadata_uri) {
        args.push('--metadata-uri');
        args.push(options.metadata_uri);
      } else if (settings.metadata_uri) {
        args.push('--metadata-uri');
        args.push(settings.metadata_uri);
      }

      if (options.test || (settings !== undefined && settings.test_mode)) {
        args.push('--test-mode');
      }
      if (options.no_js_header) {
        args.push('--no-js-header');
      }
      if (settings.compiler_json) {
        args.push('--json');
      }
    }
    args.push(path);
  }
  return args;
}

async function callArchetype(options, path, s) {
  const verbose = options.verbose;

  const config = getConfig();
  // const isFrombin = config.archetype_from_bin ? config.archetype_from_bin : false;
  const archetypeMode = config.mode.archetype;

  switch (archetypeMode) {
    case 'binary':
      {
        const bin = config.bin.archetype;
        const args = computeArgsSettings(options, s, path);

        if (verbose) {
          print(args);
        }

        return new Promise(async (resolve, reject) => {
          try {
            const { stdout, stderr, failed } = await execa(bin, args, {});
            if (failed) {
              const msg = "Archetype compiler: " + stderr;
              reject(msg);
            } else {
              resolve(stdout);
            }
          } catch (e) {
            reject(e);
          }
        })
      };
    case 'js':
      {
        if (archetype == null) {
          archetype = require('@completium/archetype');
        }
        if (s.version) {
          return archetype.version()
        } else {
          try {
            const settings = computeSettings(options, s);

            if (verbose) {
              print(settings);
            }

            const a = await archetype.compile(path, settings);
            return a;
          } catch (error) {
            if (error.message) {
              const msg = "Archetype compiler: " + error.message;
              throw msg;
            } else {
              throw error;
            }
          }
        }
      }
    case 'docker':
      {
        const docker_bin = 'docker';
        const cwd = process.cwd();
        const args = ['run', '--platform=linux/amd64', '--rm', '-v', `${cwd}:${cwd}`, '-w', `${cwd}`, 'completium/archetype:latest'].concat(computeArgsSettings(options, s, path));

        if (verbose) {
          print(args);
        }

        return new Promise(async (resolve, reject) => {
          try {
            const { stdout, stderr, failed } = await execa(docker_bin, args, {});
            if (failed) {
              const msg = "Archetype compiler: " + stderr;
              reject(msg);
            } else {
              resolve(stdout);
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    default:
      throw 'Archetype compiler: unknown mode';
  }
}

function expr_micheline_to_json(input) {
  return (new codec.Parser()).parseMichelineExpression(input.toString());
}

function json_micheline_to_expr(input) {
  return codec.emitMicheline(input);
}

function getAmount(raw) {
  if (typeof raw !== "string") {
    throw ('amount must be a string')
  }
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (isNull(v)) {
    const msg = `'${raw}' is an invalid value; expecting for example, 1tz or 2utz.`;
    throw msg;
  }
  let rat = new Fraction(v.str);
  if (!v.utz) {
    rat = rat.multiply(new Fraction(1000000, 1))
  }
  if (rat.denominator != 1) {
    const msg = `'${raw}' is an invalid value.`;
    throw msg;
  }
  return rat.numerator;
}

async function getArchetypeVersion() {
  const v = await callArchetype({}, null, { version: true });
  return v;
}

async function show_entries_internal(i, rjson) {
  const config = getConfig();
  const isFrombin = config.archetype_from_bin ? config.archetype_from_bin : false;

  if (isFrombin) {
    const bin = config.bin.archetype;

    const tmp = require('tmp');
    const tmpobj = tmp.fileSync({ postfix: '.json' });

    const path = tmpobj.name;
    fs.writeFileSync(path, i);

    const args = []
    args.push('-rj');
    args.push('-j');
    args.push('--show-entries');
    args.push(path);

    return new Promise(async (resolve, reject) => {
      try {
        const { stdout, stderr, failed } = await execa(bin, args, {});
        if (failed) {
          const msg = "Archetype compiler: " + stderr;
          reject(msg);
        } else {
          resolve(stdout);
        }
      } catch (e) {
        reject(e);
      }
    });

  } else {
    if (archetype == null) {
      archetype = require('@completium/archetype');
    }
    const res = archetype.show_entries(i, {
      json: true,
      rjson: rjson
    });
    return res;
  }
}

function isMockupMode() {
  var config = getConfig();
  const tezos_endpoint = config.tezos.endpoint;
  return tezos_endpoint === "mockup";
}

function isForceTezosClient() {
  var config = getConfig();
  const force_tezos_client = config.tezos.force_tezos_client;
  return force_tezos_client !== undefined && force_tezos_client;
}

async function callTezosClient(args) {
  let arguments;
  if (isMockupMode()) {
    arguments = ["--mode", "mockup", "--base-dir", mockup_path].concat(args);
  } else {
    const tezos_endpoint = config.tezos.endpoint;
    arguments = ["--endpoint", tezos_endpoint].concat(args);
  }
  try {
    const bin = config.bin['tezos-client'];
    const x = await execa(bin, arguments, {});
    return x;
  } catch (e) {
    return e;
  }
}

async function retrieveBalanceFor(addr) {
  if (isMockupMode()) {
    const args = ["rpc", "get", "/chains/main/blocks/head/context/contracts/" + addr + "/balance"];
    const { stdout, stderr, failed } = await callTezosClient(args);
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      const val = JSON.parse(stdout);
      const res = new BigNumber(val);
      return res;
    }
  } else {
    const tezos = getTezos();

    var balance = await tezos.tz.getBalance(addr);
    return balance;
  }
}

async function rpcGet(uri) {
  if (isMockupMode()) {
    const { stdout, stderr, failed } = await callTezosClient(["rpc", "get", uri]);
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      const res = JSON.parse(stdout);
      return res;
    }
  } else {
    const config = getConfig();
    const tezos_endpoint = config.tezos.endpoint;
    const request = require('request');
    const url = tezos_endpoint + uri;
    return new Promise((resolve, reject) => {
      request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const res = JSON.parse(body);
          resolve(res);
        } else {
          const msg = (`Error get status code : ${response.statusCode}`);
          reject(msg);
        }
      })
    });
  }
}

async function rpcPost(uri, payload) {
  if (isMockupMode()) {
    const { stdout, stderr, failed } = await callTezosClient(["rpc", "post", uri, "with", JSON.stringify(payload)]);
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      const res = JSON.parse(stdout);
      return res;
    }
  } else {
    const config = getConfig();
    const tezos_endpoint = config.tezos.endpoint;
    const request = require('request');
    const url = tezos_endpoint + uri;


    return new Promise((resolve, reject) => {
      request.post(url, { json: payload }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const res = body;
          resolve(res);
        } else {
          const msg = (`Error get status code : ${response.statusCode}`);
          reject(msg);
        }
      })
    });
  }
}

async function getChainId() {
  if (isMockupMode()) {
    const input = loadJS(context_mockup_path);
    return input.chain_id;
  } else {
    return new Promise((resolve, reject) => {
      rpcGet("/chains/main/blocks/head/header")
        .then(x => {
          if (x && x.chain_id) {
            resolve(x.chain_id)
          }
        })
        .catch(err => {
          reject(err)
        })
    });
  }

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
  print("  install archetype")
  print("")
  print("  start sandbox");
  print("  stop sandbox");
  print("")
  print("  mockup init [--protocol <VALUE>]");
  print("  mockup set now <value>");
  print("")
  print("  show endpoint");
  print("  switch endpoint");
  print("  add endpoint (main|ghost|kathmandu|lima|sandbox) <ENDPOINT_URL>");
  print("  set endpoint <ENDPOINT_URL>");
  print("  remove endpoint <ENDPOINT_URL>");
  print("")
  print("  set mode archetype (js|docker|binary)")
  print("  switch mode archetype")
  print("  show mode archetype")
  print("  set binary path (archetype|tezos-client) <PATH>");
  print("  show binary path (archetype|tezos-client)");
  print("")
  print("  generate account as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]");
  print("  import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]");
  print("  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]");
  print("")
  print("  show keys from <PRIVATE_KEY>");
  print("  set account <ACCOUNT_ALIAS>");
  print("  switch account");
  print("  rename account <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> by <ACCOUNT_ALIAS> [--force]");
  print("  remove account <ACCOUNT_ALIAS>");
  print("")
  print("  transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> [--force]");
  print("  deploy <FILE.arl> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--init <MICHELSON_DATA> | --parameters <PARAMETERS> | --parameters-micheline <PARAMETERS>] [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>] [--force] [--show-tezos-client-command]");
  print("  originate <FILE.tz> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)]  [--force-tezos-client] [--force] [--show-tezos-client-command]");
  print("  call <CONTRACT_ALIAS> [--as <ACCOUNT_ALIAS>] [--entry <ENTRYPOINT>] [--arg <ARGS> | --arg-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--force] [--show-tezos-client-command]");
  print("  run <FILE.arl> [--entry <ENTRYPOINT>] [--arg-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--trace] [--force]");
  print("  run getter <GETTER_ID> on <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--arg <MICHELSON_DATA>] [--as <CALLER_ADDRESS>]");
  print("  register global constant <MICHELSON_DATA> [--as <CALLER_ADDRESS>] [--force]");
  print("  generate michelson <FILE.arl|CONTRACT_ALIAS>");
  print("  generate javascript <FILE.arl|CONTRACT_ALIAS>");
  print("  generate whyml <FILE.arl|CONTRACT_ALIAS>");
  print("  generate event-binding-js <FILE.arl|CONTRACT_ALIAS>");
  print("  generate event-binding-ts <FILE.arl|CONTRACT_ALIAS>");
  print("  generate binding-ts <FILE.arl|CONTRACT_ALIAS> [--input-path <PATH> --output-path <PATH>]");
  print("  generate binding-dapp-ts <FILE.arl|CONTRACT_ALIAS> [--input-path <PATH> --output-path <PATH>] [--with-dapp-originate]");
  print("  generate contract interface <FILE.arl|FILE.tz|CONTRACT_ALIAS>");
  print("")
  print("  show accounts");
  print("  show account [--with-private-key] [--alias <ALIAS>]");
  print("  show contracts");
  print("  show contract <CONTRACT_ALIAS>");
  print("  show entries <CONTRACT_ADDRESS>");
  print("  rename contract <CONTRACT_ALIAS|CONTRACT_ADDRESS> by <CONTRACT_ALIAS> [--force]");
  print("  remove contract <CONTRACT_ALIAS>");
  print("  show url <CONTRACT_ALIAS>");
  print("  show source <CONTRACT_ALIAS>");
  print("  show address <CONTRACT_ALIAS|ACCOUNT_ALIAS>");
  print("  show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--json]");
  print("  show script <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--json]");
  print("  get balance for <ACCOUNT_NAME|ACCOUNT_ADDRESS>");
  print("")
  print("  log enable");
  print("  log disable");
  print("  log clear [--force]");
  print("  log dump");
  print("")
  print("  create project <PROJECT_NAME>");
  print("  get completium property <VALUE>");
}

async function initCompletium(options) {
  const config = {
    account: 'alice',
    mode: {
      archetype: 'js',
      'tezos-client': 'binary'
    },
    bin: {
      archetype: 'archetype',
      'tezos-client': 'octez-client'
    },
    tezos: {
      force_tezos_client: false,
      network: 'ghost',
      endpoint: 'https://ghostnet.ecadinfra.com',
      list: [
        {
          network: 'main',
          bcd_url: "https://better-call.dev/main/${address}",
          tzstat_url: "https://tzstats.com",
          endpoints: [
            'https://mainnet.api.tez.ie',
            'https://mainnet.smartpy.io',
            'https://mainnet.tezos.marigold.dev',
            'https://mainnet-tezos.giganode.io',
            'https://rpc.tzbeta.net'
          ]
        },
        {
          network: 'ghost',
          bcd_url: "https://better-call.dev/ghostnet/${address}",
          tzstat_url: "https://tzstats.com",
          endpoints: [
            'https://ghostnet.ecadinfra.com',
            'https://ghostnet.smartpy.io',
            'https://ghostnet.tezos.marigold.dev'
          ]
        },
        {
          "network": "lima",
          "bcd_url": "https://better-call.dev/limanet/${address}",
          "tzstat_url": "https://lima.tzstats.com",
          "endpoints": [
            "https://limanet.ecadinfra.com",
            "https://limanet.smartpy.io",
            "https://limanet.tezos.marigold.dev"
          ]
        },
        {
          "network": "mumbai",
          "bcd_url": "https://better-call.dev/mumbainet/${address}",
          "tzstat_url": "https://mumbai.tzstats.com",
          "endpoints": [
            "https://mumbainet.ecadinfra.com",
            "https://mumbainet.smartpy.io",
            "https://mumbainet.tezos.marigold.dev"
          ]
        },
        {
          network: "sandbox",
          bcd_url: "https://localhost:8080/sandbox/${address}",
          endpoints: [
            "http://localhost:20000",
            "http://localhost:8732"
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

  const exists = fs.existsSync(config_path);

  if (exists) {
    const old_config = getConfig();
    const old_account = old_config.account;
    const old_bin = old_config.bin;
    const old_mode = old_config.mode;

    const new_config = { ...old_config, ...config };
    if (old_account) {
      new_config.account = old_account;
    }
    if (old_bin) {
      new_config.bin = old_bin
    }
    if (old_mode) {
      new_config.mode = old_mode
    }

    saveFile(config_path, new_config, (x => {
      print("Completium updated successfully!")
    }))
  } else {

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
        },
        {
          "name": "carl",
          "pubk": "edpkugep78JxqeTzJ6N2dvAUKBGdHrHVbytAzUHGLLHrfXweSzX2oG",
          "pkh": "tz1aGDrJ58LbcnD47CkwSk3myfTxJxipYJyk",
          "key": {
            "kind": "private_key",
            "value": "edskS8eMgJopZofUWiuzRTrQJPGRoR3mcYEhhp2BTpR91ZMjmvHMEdfoPFfGaiXSV9M1NG21r4zQcz5QYPY1BtqigMSrd8eVUv"
          }
        },
        {
          "name": "bootstrap1",
          "pkh": "tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx",
          "pubk": "edpkuBknW28nW72KG6RoHtYW7p12T6GKc7nAbwYX5m8Wd9sDVC9yav",
          "key": {
            "kind": "private_key",
            "value": "edsk3gUfUPyBSfrS9CCgmCiQsTCHGkviBDusMxDJstFtojtc1zcpsh"
          }
        },
        {
          "name": "bootstrap2",
          "pkh": "tz1gjaF81ZRRvdzjobyfVNsAeSC6PScjfQwN",
          "pubk": "edpktzNbDAUjUk697W7gYg2CRuBQjyPxbEg8dLccYYwKSKvkPvjtV9",
          "key": {
            "kind": "private_key",
            "value": "edsk39qAm1fiMjgmPkw1EgQYkMzkJezLNewd7PLNHTkr6w9XA2zdfo"
          }
        },
        {
          "name": "bootstrap3",
          "pkh": "tz1faswCTDciRzE4oJ9jn2Vm2dvjeyA9fUzU",
          "pubk": "edpkuTXkJDGcFd5nh6VvMz8phXxU3Bi7h6hqgywNFi1vZTfQNnS1RV",
          "key": {
            "kind": "private_key",
            "value": "edsk4ArLQgBTLWG5FJmnGnT689VKoqhXwmDPBuGx3z4cvwU9MmrPZZ"
          }
        },
        {
          "name": "bootstrap4",
          "pkh": "tz1b7tUupMgCNw2cCLpKTkSD1NZzB5TkP2sv",
          "pubk": "edpkuFrRoDSEbJYgxRtLx2ps82UdaYc1WwfS9sE11yhauZt5DgCHbU",
          "key": {
            "kind": "private_key",
            "value": "edsk2uqQB9AY4FvioK2YMdfmyMrer5R8mGFyuaLLFfSRo8EoyNdht3"
          }
        },
        {
          "name": "bootstrap5",
          "pkh": "tz1ddb9NMYHZi5UzPdzTZMYQQZoMub195zgv",
          "pubk": "edpkv8EUUH68jmo3f7Um5PezmfGrRF24gnfLpH3sVNwJnV5bVCxL2n",
          "key": {
            "kind": "private_key",
            "value": "edsk4QLrcijEffxV31gGdN2HU7UpyJjA8drFoNcmnB28n89YjPNRFm"
          }
        }]
      }, (y => {
        saveFile(contracts_path, { contracts: [] }, (z => { print("Completium initialized successfully!") }));
      }))
    }));
  }
}

async function doInstall(options) {
  const bin = options.bin;
  const verbose = options.verbose;

  check_bin_archetype(bin);

  try {
    const { stdout } = await execa('docker', ['pull', `completium/archetype:latest`], {});
    if (verbose) {
      print(stdout);
    }
    print(stdout)

  } catch (error) {
    print(error);
    throw error;
  }

}

async function startSandbox(options) {
  const verbose = options.verbose;
  print('Waiting for sandbox to start ...');
  try {
    const { stdout } = await execa('docker', ['run', '--rm', '--name', 'my-sandbox', '--detach', '-p', '20000:20000', '--cpus', '1', '-e', 'block_time=10',
      docker_id, flextesa_script, 'start'], {});
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

async function mockupInit(options) {
  setEndpoint({ endpoint: "mockup" })

  const protocol = options.protocol ? options.protocol : default_mockup_protocol
  const config = getConfig();
  fs.rmSync(mockup_path, { force: true, recursive: true });
  const { stdout } = await execa(config.bin['tezos-client'], [
    '--protocol', protocol,
    '--base-dir', mockup_path,
    '--mode', 'mockup',
    'create', 'mockup'
  ], {});

  print(stdout);
  print("Importing account ...");

  const importAccount = async (name, key) => {
    print(`Importing ${name}`)
    const uri = "unencrypted:" + key.value;
    await callTezosClient(["import", "secret", "key", name, uri, "--force"]);
  };

  const transferAccount = async (name, pkh) => {
    if (name !== "bootstrap1" && name !== "bootstrap2" && name !== "bootstrap3" && name !== "bootstrap4" && name !== "bootstrap5") {
      print(`Transfer ${pkh}`)
      await callTezosClient(["transfer", "10000", "from", "bootstrap1", "to", pkh, "--burn-cap", "0.06425"]);
    }
  };

  const accounts = getAccounts().accounts;

  for (const x of accounts) {
    const name = x.name;
    const pkh = x.pkh;
    const key = x.key;

    await importAccount(name, key);
    await transferAccount(name, pkh);
  }

  const event_well_contract_name = 'event_well'
  const event_well_script = `{ storage unit; parameter (bytes %event); code { UNPAIR; DROP; NIL operation; PAIR } }`

  // deploy event well contract
  await callTezosClient(["originate", "contract", event_well_contract_name,
    "transferring", "0", "from", "bootstrap1",
    "running", event_well_script, "--init", "Unit",
    "--burn-cap", "20", "--force", "--no-print-source"]);

  const path_contracts = mockup_path + "/contracts";
  const inputContracts = fs.readFileSync(path_contracts, 'utf8');
  const cobj = JSON.parse(inputContracts);
  const o = cobj.find(x => { return (x.name === event_well_contract_name) });
  const contract_address = isNull(o) ? null : o.value;

  const mockupConf = getMockupConfig();
  saveMockupConfig({ ...mockupConf, event_well: contract_address })
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

function setEndpoint(options) {
  const endpoint = options.endpoint;

  const config = getConfig();
  const network = config.tezos.list.find(x => x.endpoints.includes(endpoint));

  if (isNull(network)) {
    throw new Error(`'${endpoint}' is not found.`);
  }

  config.tezos.network = network.network;
  config.tezos.endpoint = endpoint;

  saveConfig(config);
  print(`endpoint '${endpoint}' for network ${network.network} set.`);
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

function check_bin(bin) {
  if (bin !== 'tezos-client' && bin !== 'archetype') {
    const msg = `Invalid binary "${bin}", expecting 'tezos-client' or 'archetype'`;
    throw msg;
  }
}

function check_bin_archetype(bin) {
  if (bin !== 'archetype') {
    const msg = `Invalid binary "${bin}", expecting 'archetype'`;
    throw msg;
  }
}

function check_mode_value(mode) {
  if (mode !== 'js' && mode !== 'docker' && mode !== 'binary') {
    const msg = `Invalid mode ${mode}, expecting 'js' 'docker' or 'binary'`;
    throw msg;
  }
}

async function setMode(options) {
  const bin = options.bin;
  const mode = options.value;

  check_bin_archetype(bin)
  check_mode_value(mode)

  const config = getConfig();
  config.mode[bin] = mode;
  saveConfig(config, x => { print(`${bin} mode set to ${mode}`) })
}

async function switchMode(options) {
  const bin = options.bin;

  check_bin_archetype(bin)

  const config = getConfig();
  const mode = config.mode[bin];
  print(`Current ${bin} mode: ${mode}`);

  const { Select } = require('enquirer');

  const prompt = new Select({
    name: 'color',
    message: `Switch ${bin} mode`,
    choices: ['js', 'docker', 'binary'],
  });

  prompt.run()
    .then(mode => {
      config.mode[bin] = mode;
      saveConfig(config, x => { print(`${bin} mode set to ${mode}`) })
    })
    .catch(console.error);
}

async function showMode(options) {
  const bin = options.bin;
  check_bin(bin)
  const config = getConfig();
  const mode = config.mode[bin];
  print(`${bin} mode: ${mode}`)
}

async function setBinPath(options) {
  const bin = options.bin;
  const path = options.value;
  check_bin(bin)
  const config = getConfig();
  config.bin[bin] = path;
  saveConfig(config, x => { print(`'${bin}' binary path set to ${path}`) })
}

async function showBinPath(options) {
  const bin = options.bin;
  check_bin(bin)
  const config = getConfig();
  const path = config.bin[bin];
  print(`${bin} binary path: ${path}`)
}

async function confirmAccount(force, account) {
  if (force || isNull(getAccount(account))) { return true }

  const str = `${account} already exists, do you want to overwrite?`;
  return new Promise(resolve => { askQuestionBool(str, answer => { resolve(answer); }) });
}

async function generateAccount(options) {
  const alias = options.value;
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
  const alias = options.account;
  const force = options.force;
  const with_tezos_client = options.with_tezos_client;

  var confirm = await confirmAccount(force, alias);
  if (!confirm) {
    return;
  }

  const config = getConfig();
  const tezos = new taquito.TezosToolkit(import_endpoint);
  switch (kind) {
    case "faucet":
      const faucet = loadJS(value);
      print(`Importing key ...`);
      const secret = faucet.secret ? faucet.secret : (faucet.activation_code ? faucet.activation_code : "");
      await signer.importKey(tezos,
        faucet.email,
        faucet.password,
        faucet.mnemonic.join(' '),
        secret)
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
  const sk = await tezos.signer.secretKey();
  saveAccountWithId(alias, pubk, pkh, sk);
  if (with_tezos_client || isMockupMode()) {
    const args = ["import", "secret", "key", alias, ("unencrypted:" + sk)];
    await callTezosClient(args);
    if (isMockupMode()) {
      await callTezosClient(["transfer", "10000", "from", "bootstrap1", "to", pkh, "--burn-cap", "0.06425"]);
    }
  }
}

async function importFaucet(options) {
  importAccount("faucet", options);
}

async function importPrivatekey(options) {
  importAccount("privatekey", options);
}

async function getKeysFrom(sk) {
  const signer = new signer.InMemorySigner(sk);
  const pk = await tezos.signer.publicKey();
  const pkh = await tezos.signer.publicKeyHash();
  const sk2 = await tezos.signer.secretKey();
  return {
    pkh: pkh,
    pk: pk,
    sk: sk2,
  }
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
  const alias = options.alias;
  let value = config.account;
  const withPrivateKey = options.withPrivateKey;

  if (!isNull(alias)) {
    value = alias
  }

  if (isNull(value)) {
    print("No account is set.");
  } else {
    const account = getAccount(value);
    if (isNull(account)) {
      return print(`'${value}' is not found.`);
    }
    print(`Current account:\t${account.name}`);
    showKeyInfo(account.pubk, account.pkh, withPrivateKey ? account.key.value : null);
    var balance = await retrieveBalanceFor(account.pkh);
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

function setAccount(options) {
  const value = options.account;

  const account = getAccount(value);
  if (isNull(account)) {
    throw new Error(`'${value}' is not found.`);
  }
  const config = getConfig();
  config.account = value;
  saveConfig(config)
  print(`'${value}' is set as current account.`);
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

  const str = `Confirm transfer ${amount / 1000000} ꜩ from ${from.name} to ${to} on ${config.tezos.network}?`;
  return new Promise(resolve => { askQuestionBool(str, answer => { resolve(answer); }) });
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

  const config = getConfig();
  const network = config.tezos.list.find(x => x.network === config.tezos.network);

  print(`Transfering ${amount / 1000000} ꜩ from ${accountFrom.pkh} to ${to_addr}...`);
  if (isMockupMode()) {
    const a = (amount / 1000000).toString();
    const args = ["transfer", a, "from", accountFrom.pkh, "to", to_addr, "--burn-cap", "0.06425"];
    const { stdout, stderr, failed } = await callTezosClient(args);
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      print(stdout);
    }
    return new Promise(resolve => { resolve(null) });
  } else {
    const tezos = getTezos(accountFrom.name);
    return new Promise((resolve, reject) => {
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
              reject(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
            });
        })
        .catch((error) => {
          reject(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
        });
    });
  }
}

async function confirmContract(force, id) {
  if (force || isNull(getContract(id))) { return true }

  const str = `${id} already exists, overwrite it?`;
  return new Promise(resolve => { askQuestionBool(str, answer => { resolve(answer); }) });
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

  const encode = (schema, type, jdata) => {
    try {
      return schema.Encode(jdata);
    } catch (e) {
      throw {
        message: 'Typecheck error',
        data: jdata,
        type: json_micheline_to_expr(type)
      }
    }
  }

  if (type.prim !== undefined) {
    const schema = new encoder.Schema(type);
    const prim = type.prim;
    switch (prim) {
      case 'address':
      case 'bls12_381_fr':
      case 'bls12_381_g1':
      case 'bls12_381_g2':
      case 'bool':
      case 'chain_id':
      case 'contract':
      case 'int':
      case 'key':
      case 'key_hash':
      case 'lambda':
      case 'nat':
      case 'never':
      case 'operation':
      case 'sapling_state':
      case 'sapling_transaction':
      case 'signature':
      case 'string':
      case 'ticket':
      case 'unit':
        return encode(schema, type, jdata)
      case 'bytes':
      case 'chest':
      case 'chest_key':
        let bdata = jdata;
        if (bdata.startsWith && bdata.startsWith("0x")) {
          bdata = bdata.substring(2);
        }
        return { bytes: bdata }
      case 'mutez':
        if (typeof jdata === "string" && jdata.endsWith("tz")) {
          const v = getAmount(jdata);
          return { "int": v.toString() }
        } else {
          return encode(schema, type, jdata)
        }
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
        return encode(schema, type, vdate)
      case 'big_map':
      case 'map':
        const kmtype = type.args[0];
        const vmtype = type.args[1];
        if (jdata instanceof Array) {
          const mdata = jdata.map((x) => {
            if (x.key === undefined || x.value === undefined) {
              throw new Error("Type map error: no 'key' or 'value' for one item")
            }
            const k = build_from_js(kmtype, x.key);
            const v = build_from_js(vmtype, x.value);
            return { "prim": "Elt", args: [k, v] };
          });
          return mdata;
        } else {
          throw new Error(`Type map error: ${jdata} is not a map`)
        }
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
      case 'set':
      case 'list':
        const largs = [];
        if (type.args.length == 0) {
          throw new Error("Unknown type list");
        }
        for (let i = 0; i < jdata.length; ++i) {
          const data = build_from_js(type.args[0], jdata[i]);
          largs.push(data);
        }
        return largs;
      case 'option':
        if (jdata == null) {
          return encode(schema, type, jdata)
        } else {
          if (type.args.length == 0) {
            throw new Error("Unknown type option");
          }
          let arg = jdata;
          // if (typeof jdata !== "string" && jdata.length && jdata.length > 0) {
          //   arg = jdata[0];
          // }
          const v = build_from_js(type.args[0], arg);
          return { prim: "Some", args: [v] };
        }
      default:
        throw new Error("Unknown type prim: " + prim)
    }

  } else {
    throw new Error("Unknown type")
  }
}

var objValues = {};

function build_data_michelson(type, storage_values, parameters, parametersMicheline) {
  const is_micheline = !isNull(parametersMicheline);
  const p = is_micheline ? parametersMicheline : parameters;
  if (type.annots !== undefined && type.annots.length > 0) {
    const annot1 = type.annots[0];
    const annot = annot1.startsWith("%") ? annot1.substring(1) : annot1;

    if (p[annot] !== undefined) {
      const t = type;
      let data = null;
      if (is_micheline) {
        data = p[annot]
      } else {
        const d = p[annot];
        data = build_from_js(t, d);
      }
      objValues[annot] = data;
      return data;
    } else if (storage_values[annot] !== undefined) {
      const data = expr_micheline_to_json(storage_values[annot]);
      return data;
    } else {
      throw new Error(annot + " is not found.");
    }

  } else if (type.prim !== undefined && type.prim === "pair" && type.annots === undefined
    // && (type.args.length > 2 && type.args[0].prim === "int" && type.args[1].prim === "nat"
    //   && type.args[0].annots.length == 0 && type.args[1].annots.length == 0)
  ) {

    let args;
    if (Object.keys(storage_values).length == 0 && Object.keys(parameters).length == 1) {
      const ds = Object.values(p)[0];
      args = [];
      for (let i = 0; i < type.args.length; ++i) {
        let a = null
        if (is_micheline) {
          a = ds[i]
        } else {
          const d = ds[i];
          const t = type.args[i];
          a = build_from_js(t, d);
        }
        args.push(a);
      }
    } else {
      args = type.args.map((t) => {
        return build_data_michelson(t, storage_values, parameters, parametersMicheline);
      });
    }

    return { "prim": "Pair", args: args };
  } else {
    if (is_micheline) {
      return Object.values(p)[0]
    } else {
      const d = Object.values(p)[0];
      return build_from_js(type, d);
    }
  }
}

function replaceAll(data, objValues) {
  if (data.prim !== undefined) {
    if (objValues[data.prim] !== undefined) {
      return objValues[data.prim];
    } else if (data.args !== undefined) {
      const nargs = data.args.map(x => replaceAll(x, objValues));
      return { ...data, args: nargs }
    } else {
      return data;
    }
  } else if (data.length !== undefined) {
    return data.map(x => replaceAll(x, objValues))
  } else {
    return data;
  }
}

async function compute_tzstorage(file, storageType, parameters, parametersMicheline, contract_parameter, options, s) {
  const is_micheline = !isNull(parametersMicheline);
  const parameters_var = []
  const parameters_const = []
  if (!isNull(contract_parameter)) {
    for (i = 0; i < contract_parameter.length; ++i) {
      const cp = contract_parameter[i];
      const name = cp.name;
      const p = is_micheline ? parametersMicheline[name] : parameters[name];
      if (p !== undefined) {
        if (cp.const) {
          parameters_const.push(p)
        } else {
          parameters_var.push(p)
        }
      } else {
        throw new Error(`Error: parameter "${name}" not found.`)
      }
    }
  }
  let michelsonData;
  if (parameters_var.length > 0) {
    const storage_values = await callArchetype({}, file, { ...s, get_storage_values: true });
    const jsv = JSON.parse(storage_values);
    const sv = jsv.map(x => x);
    var obj = {};
    sv.forEach(x => {
      obj[x.id] = x.value
    });

    objValues = {};
    const data = build_data_michelson(storageType, obj, parameters, parametersMicheline);
    michelsonData = replaceAll(data, objValues);
  } else {
    const storage_values = await callArchetype(options, file, {
      target: "michelson-storage"
    });
    michelsonData = expr_micheline_to_json(storage_values);
  }

  if (parameters_const.length > 0) {
    michelsonData = process_const(michelsonData, parameters, parametersMicheline, contract_parameter);
  }

  return michelsonData;
}

function replace_json(obj, id, data) {
  if (obj instanceof Array) {
    return (obj.map(x => replace_json(x, id, data)))
  } else if (obj.prim) {
    const prim = obj.prim;
    if (prim == id) {
      return data;
    }
    if (obj.args) {
      return { ...obj, args: obj.args.map(x => replace_json(x, id, data)) }
    }
  }
  return obj;
}
function process_const(obj, parameters, parametersMicheline, contract_parameter) {
  const is_micheline = !isNull(parametersMicheline);
  for (i = 0; i < contract_parameter.length; ++i) {
    const cp = contract_parameter[i];
    if (cp.const) {
      const name = cp.name;
      const value = is_micheline ? parametersMicheline[name] : parameters[name];
      if (isNull(value)) {
        throw new Error(`Error: parameter "${name}" not found.`)
      }
      let data = null;
      if (is_micheline) {
        data = value;
      } else {
        const ty = expr_micheline_to_json(cp.type_);
        data = build_from_js(ty, value);
      }
      obj = replace_json(obj, name, data)
    }
  }
  return obj;
}

function process_code_const(str, parameters, parametersMicheline, contract_parameter) {
  const is_micheline = !isNull(parametersMicheline);
  for (i = 0; i < contract_parameter.length; ++i) {
    const cp = contract_parameter[i];
    if (cp.const) {
      const name = cp.name;
      const ty = expr_micheline_to_json(cp.type_);
      let data = null;
      if (is_micheline) {
        data = parametersMicheline[name]
      } else {
        const value = parameters[name];
        if (isNull(value)) {
          throw new Error(`Error: parameter "${name}" not found.`)
        }
        data = build_from_js(ty, value);
      }
      const str_data = json_micheline_to_expr(data);
      const pattern = 'const_' + name + '__';
      str = str.replaceAll(pattern, str_data);
    }
  }
  return str;
}

function print_deploy_settings(with_color, account, contract_id, amount, storage, estimated_total_cost) {
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';
  print(`Originate settings:`);
  print(`  ${start}network${end}\t: ${config.tezos.network}`);
  print(`  ${start}contract${end}\t: ${contract_id}`);
  print(`  ${start}as${end}\t\t: ${account.name}`);
  print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  print(`  ${start}storage${end}\t: ${storage}`);
  if (estimated_total_cost != null) {
    print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
  }
}

async function confirmDeploy(force, account, contract_id, amount, storage, estimated_total_cost) {
  if (force) { return true }

  print_deploy_settings(true, account, contract_id, amount, storage, estimated_total_cost);
  return new Promise(resolve => { askQuestionBool("Confirm settings", answer => { resolve(answer); }) });
}

function getTezosClientArgs(args) {
  const config = getConfig();
  let b = `tezos-client --endpoint ${config.tezos.endpoint}`;

  args.forEach(x => {
    const y = x.includes(' ') || x.includes('"') ? `'${x}'` : x
    b += " " + y
  })
  return b.toString()
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
  const contract_json = options.contract_json;
  const storage_json = options.storage_json;
  const parameters = options.iparameters !== undefined ? JSON.parse(options.iparameters) : options.parameters;
  const parametersMicheline = options.iparametersMicheline !== undefined ? JSON.parse(options.iparametersMicheline) : options.parametersMicheline;
  const otest = options.test;
  const mockup_mode = isMockupMode();
  const force_tezos_client = options.force_tezos_client === undefined ? isForceTezosClient() : options.force_tezos_client;
  const show_tezos_client_command = options.show_tezos_client_command === undefined ? false : options.show_tezos_client_command;

  if (otest && originate) {
    const msg = `Cannot originate a contract in test mode.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (otest && isMockupMode()) {
    const msg = `Cannot deploy a contract in test mode on mockup mode.`;
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

  if (!isNull(contract_json) && isNull(named)) {
    const msg = `\`named\` field missing`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const contract_name = named === undefined ? path.basename(file).split('.').slice(0, -1).join('.') : named;
  var confirm = await confirmContract(force || show_tezos_client_command, contract_name);
  if (!confirm) {
    const msg = `Not confirmed`
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let code;
  if (!isNull(contract_json)) {
    code = json_micheline_to_expr(contract_json);
  } else {
    if (!fs.existsSync(file)) {
      const msg = `File not found.`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
    if (originate) {
      const input = fs.readFileSync(file).toString();
      if (file.endsWith(".json")) {
        const jinput = JSON.parse(input);
        code = json_micheline_to_expr(jinput);
      } else {
        code = input;
      }
    } else {
      try {
        code = await callArchetype(options, file, {
          target: "michelson",
          sci: account.pkh
        });
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    }
  }

  let contract_parameter = null;
  if (!originate) {
    const with_parameters = await callArchetype(options, file, {
      with_parameters: true
    });
    if (with_parameters !== "") {
      if (isNull(parameters) && isNull(parametersMicheline)) {
        const msg = `The contract has the following parameter:\n${with_parameters}\nPlease use '--parameters' to initialize.`;
        return new Promise((resolve, reject) => { reject(msg) });
      } else {
        contract_parameter = JSON.parse(with_parameters);
      }
    }
  }

  if (contract_parameter != null) {
    code = process_code_const(code, parameters, parametersMicheline, contract_parameter);
  }

  let m_storage;
  if (!isNull(storage_json)) {
    m_storage = storage_json;
  } else if (!isNull(oinit)) {
    m_storage = expr_micheline_to_json(oinit);
  } else if (!originate) {
    if (isNull(parameters) && isNull(parametersMicheline)) {
      try {
        const storage = await callArchetype(options, file, {
          target: "michelson-storage",
          sci: account.pkh
        });
        m_storage = expr_micheline_to_json(storage);
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    } else {
      try {
        const m_code = expr_micheline_to_json(code);
        const obj_storage = m_code.find(x => x.prim === "storage");
        const storageType = obj_storage.args[0];
        m_storage = await compute_tzstorage(file, storageType, parameters, parametersMicheline, contract_parameter, options, computeSettings(options));
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    }
  } else {
    m_storage = expr_micheline_to_json("Unit");
  }

  const ext = originate ? 'tz' : 'arl';
  let source = null;
  if (!isNull(file)) {
    source = await copySource(file, ext, contract_name);
  }
  const contract_path = await copyContract(code, contract_name);
  const version = await getArchetypeVersion();

  const tezos = getTezos(account.name);

  const saveC = async (resolve, op, storage, contract_address) => {
    saveContract({
      name: contract_name,
      address: contract_address,
      network: config.tezos.network,
      language: originate ? 'michelson' : 'archetype',
      compiler_version: originate ? '0' : version,
      path: contract_path,
      initial_storage: storage,
      source: source
    },
      x => {
        print(`Origination completed for ${contract_address} named ${contract_name}.`);
        if (!mockup_mode) {
          const url = network.bcd_url.replace('${address}', contract_address);
          print(url);
        }
        resolve([contract_name, op])
      });
  }

  if (dry) {
    // taquito.RpcPacker.preapplyOperations();
    print("TODO")
  } else if (mockup_mode || force_tezos_client || show_tezos_client_command) {
    const a = (amount / 1000000).toString();
    const storage = codec.emitMicheline(m_storage);
    const args = [
      "originate", "contract", contract_name,
      "transferring", a, "from", account.pkh,
      "running", contract_path, "--init", storage,
      "--burn-cap", "20", "--force", "--no-print-source"
    ];
    if (show_tezos_client_command) {
      const cmd = getTezosClientArgs(args);
      print(cmd);
      return new Promise((resolve) => { resolve(null) })
    } else {
      print_deploy_settings(false, account, contract_name, amount, storage, null);
      const { stdout, stderr, failed } = await callTezosClient(args);
      if (isLogMode() && isMockupMode()) {
        addLogOrigination({
          args_command: args,
          stdout: stdout,
          stderr: stderr,
          failed: failed,
          source: account.pkh,
          storage: storage,
          amount: a,
        })
      }
      if (failed) {
        return new Promise((resolve, reject) => { reject(stderr) });
      } else {
        print(stdout);
      }
      const path_contracts = (mockup_mode ? mockup_path : tezos_client_dir) + "/contracts";
      const inputContracts = fs.readFileSync(path_contracts, 'utf8');
      const cobj = JSON.parse(inputContracts);
      const o = cobj.find(x => { return (x.name === contract_name) });
      const contract_address = isNull(o) ? null : o.value;
      return new Promise((resolve, reject) => { saveC(resolve, null, storage, contract_address) });
    }
  } else {

    let m_code = expr_micheline_to_json(code);

    const originateParam = {
      balance: amount,
      fee: fee > 0 ? fee : undefined,
      code: m_code,
      init: m_storage,
      mutez: true
    };

    const storage = codec.emitMicheline(m_storage);

    let cont;
    try {
      const res_estimate = await tezos.estimate.originate(originateParam);
      const estimated_total_cost = res_estimate.totalCost + 100;
      cont = await confirmDeploy(force, account, contract_name, amount, storage, estimated_total_cost);
      if (!cont) {
        return new Promise((resolve, reject) => { resolve([null, null]) });
      }
      if (force) {
        print_deploy_settings(false, account, contract_name, amount, storage, estimated_total_cost);
      } else {
        print(`Forging operation...`);
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
        .then((contract) => { saveC(resolve, op, storage, contract.address) })
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
  print(`  ${start}as${end}\t\t: ${account.name}`);
  print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  print(`  ${start}entrypoint${end}\t: ${entry}`);
  print(`  ${start}argument${end}\t: ${arg}`);
  if (estimated_total_cost !== undefined) {
    print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
  }
}

function askQuestionBool(msg, lambda, defaultV) {

  var readline = require('readline');

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout

  });

  const getBool = function (input, defaultV) {
    if (input != null && input !== '') {
      return /^(y(es)?|true)$/i.test(String(input).trim());
    }
    return !defaultV;
  };

  const yn = defaultV ? '[yN]' : '[Yn]'

  const start = `\x1b[01m`;
  const end = `\x1b[0m`;

  rl.question(`${start}${msg}${end} ${yn} `, function (answer) {
    const res = getBool(answer, defaultV);
    lambda(res)
    rl.close();
  });
}

async function confirmCall(force, account, contract_id, amount, entry, arg, estimated_total_cost) {
  if (force) { return true }
  print_settings(true, account, contract_id, amount, entry, arg, estimated_total_cost);
  return new Promise(resolve => { askQuestionBool("Confirm settings", answer => { resolve(answer); }) });
}

function extract_regexp(rx, input) {
  const arr = rx.exec(input);
  return arr[1]
}

function process_event(input) {
  let events = [];

  const rx = /Internal Event:(\n)?(\s)+((.|\n)*)Consumed gas: ([0-9]+)/g;
  const arr = rx.exec(input);

  if (arr && arr.length && arr.length > 0) {
    const a = arr[0].split('Internal Event:')
    for (b of a) {
      const c = b.trim();
      if (c.length > 1) {
        const from = extract_regexp(/From: ((.)+)\n/g, c)
        const type = extract_regexp(/Type: ((.|\n)+)Tag:/g, c).trim()
        const tag = extract_regexp(/Tag: ((.)+)\n/g, c)
        const payload = extract_regexp(/Payload: ((.|\n)+)This event was successfully applied\n/g, c).trim()
        const consumed_gas = extract_regexp(/Consumed gas: ((.)+)/g, c)
        if (from && type && tag && payload && consumed_gas) {
          events.push({ from: from, type: type, tag, tag, payload: payload, consumed_gas: consumed_gas })
        }
      }
    }
  }
  return events
}

async function callTransfer(options, contract_address, arg) {
  const config = getConfig();
  const force = options.force;
  const entry = options.entry === undefined ? 'default' : options.entry;
  const quiet = options.quiet === undefined ? false : options.quiet;
  const dry = options.dry === undefined ? false : options.dry;
  const mockup_mode = isMockupMode();
  const force_tezos_client = options.force_tezos_client === undefined ? false : options.force_tezos_client;
  const verbose = options.verbose === undefined ? false : options.verbose;
  const show_tezos_client_command = options.show_tezos_client_command === undefined ? false : options.show_tezos_client_command;
  const only_param = options.only_param === undefined ? false : options.only_param;

  const contract_id = options.contract;

  const as = isNull(options.as) ? config.account : options.as;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    const msg = `Account '${as}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const amount = isNull(options.amount) ? 0 : getAmount(options.amount);
  if (isNull(amount)) {
    const msg = `Invalid amount`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const fee = isNull(options.fee) ? 0 : getAmount(options.fee);
  if (isNull(fee)) { return new Promise(resolve => { resolve(null) }); };

  const transferParam = { to: contract_address, amount: amount, fee: fee > 0 ? fee : undefined, mutez: true, parameter: { entrypoint: entry, value: arg } };

  if (only_param) {
    const res = { kind: 'transaction', ...transferParam, cost: undefined }
    return res;
  }

  if (force_tezos_client || dry || mockup_mode || show_tezos_client_command) {
    const a = (amount / 1000000).toString();
    const b = codec.emitMicheline(arg);
    const args = [
      "transfer", a, "from", account.pkh, "to", contract_address,
      "--entrypoint", entry, "--arg", b,
      "--burn-cap", "20", "--no-print-source"];
    if (dry) {
      args.push('-D')
    }
    if (show_tezos_client_command) {
      const cmd = getTezosClientArgs(args);
      print(cmd);
      return new Promise((resolve) => { resolve(null) })
    } else {
      print_settings(false, account, contract_id, amount, entry, b);
      const { stdout, stderr, failed } = await callTezosClient(args);
      if (isLogMode() && isMockupMode()) {
        addLogTransaction({
          args_command: args,
          stdout: stdout,
          stderr: stderr,
          failed: failed,
          entrypoint: entry,
          amount: a,
          arg: b,
          destination: contract_address,
          source: account.pkh,
          arg_completium: options.arg
        })
      }
      let events = null
      if (failed) {
        var rx = /FAILWITH instruction\nwith(\n)?(\s)+((.|\n)*)\nFatal .*/g;
        var arr = rx.exec(stderr);
        let err;
        if (!isNull(arr)) {
          const unescape_str = unescape(arr[3]);
          err = { value: unescape_str }
        } else {
          err = stderr
        }
        return new Promise((resolve, reject) => { reject(err) });
      } else {
        print(stdout);
        events = process_event(stdout)
      }
      const operation_hash = extractOperationHash(stdout)
      const storage_size = extractStorageSize(stdout)
      const consumed_gas = extractConsumedGas(stdout)
      const paid_storage_size_diff = extractPaidStorageSizeDiff(stdout)
      return new Promise(resolve => {
        resolve({
          operation_hash: operation_hash,
          storage_size: storage_size,
          consumed_gas: consumed_gas,
          paid_storage_size_diff: paid_storage_size_diff,
          events: events
        })
      });
    }
  } else {
    const tezos = getTezos(account.name);

    const network = config.tezos.list.find(x => x.network === config.tezos.network);

    try {
      const res = await tezos.estimate.transfer(transferParam);
      const estimated_total_cost = res.totalCost + 100;
      const arg_michelson = codec.emitMicheline(arg);
      var confirm = await confirmCall(force, account, contract_id, amount, entry, arg_michelson, estimated_total_cost);
      if (!confirm) {
        return;
      }

      if (force) {
        print_settings(false, account, contract_id, amount, entry, arg_michelson, estimated_total_cost);
      } else {
        print(`Forging operation...`);
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
}

async function exec_batch(transferParams, options) {
  const verbose = options.verbose === undefined ? false : options.verbose;

  const config = getConfig();
  const as = isNull(options.as) ? config.account : options.as;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    const msg = `Account '${as}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (isMockupMode()) {

    const obj = transferParams.map(x => {
      const destination = x.to;
      const arg = x.parameter.value;
      const entry = x.parameter.entrypoint;
      const amount = x.mutez ? (x.amount / 1000000).toString() : x.amount.toString();

      return { destination: destination, amount: amount, entrypoint: entry, arg: codec.emitMicheline(arg) }
    });
    const arg_json = JSON.stringify(obj);

    const args = [
      "multiple", "transfers", "from", account.pkh, "using", arg_json, "--burn-cap", "20"
    ];
    if (verbose) {
      print(args);
    }
    const { stdout, stderr, failed } = await callTezosClient(args);
    let events = null;
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      print(stdout);
      events = process_event(stdout)
    }
    return { events: events };

  } else {
    const tezos = getTezos(account.name);
    const batch = tezos.contract.batch(transferParams);

    // Inject operations
    return new Promise(async (resolve, reject) => {
      try {
        const op = await batch.send();
        console.log(`Waiting for ${op.hash} to be confirmed ...`);
        await op.confirmation(1);
        console.log(`${op.hash} confirmed ...`);
        resolve(op)
      } catch (error) {
        reject(error);
      }
    });
  }
}

async function runGetter(options) {
  const getterid = options.getterid;
  const contractid = options.contract;
  const json = options.json;

  let jarg;
  if (options.arg) {
    jarg = expr_micheline_to_json(options.arg)
  } else if (options.argMichelson) {
    jarg = expr_micheline_to_json(options.argMichelson)
  } else if (options.argJsonMichelson) {
    jarg = expr_micheline_to_json(json_micheline_to_expr(options.argJsonMichelson));
  } else {
    jarg = expr_micheline_to_json("Unit")
  }

  let contract_address = null;
  if (contractid.startsWith("KT1")) {
    contract_address = contractid;
  } else {
    const contract = getContractFromIdOrAddress(contractid);
    if (!isNull(contract)) {
      contract_address = contract.address;
    }
  }

  if (isNull(contract_address)) {
    const msg = `Contract not found: ${contractid}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const config = getConfig()

  const as = isNull(options.as) ? config.account : options.as;
  const addr = getAddressFromAlias(as)
  let source = isNull(addr) ? as : addr;
  if (!source.startsWith("KT1") && !source.startsWith("tz1") && !source.startsWith("tz2") && !source.startsWith("tz3")) {
    const msg = `Invalid address: ${source}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const chainid = await getChainId();

  const input = {
    "chain_id": chainid,
    "contract": contract_address,
    "entrypoint": getterid,
    "gas": "100000",
    "input": jarg,
    "payer": source,
    "source": source,
    "unparsing_mode": "Readable"
  }

  const res = await rpcPost("/chains/main/blocks/head/helpers/scripts/run_view", input);
  if (res && res.data) {
    if (json) {
      return res.data;
    }
    return json_micheline_to_expr(res.data);
  } else {
    return new Promise((resolve, reject) => { reject(res) });
  }
}

async function printGetter(options) {
  runGetter(options)
    .then(x => {
      print(x)
    })
    .catch(error => {
      print_error(error)
    })
}

async function get_view_return_type(contract_address, viewid) {
  const uri = "/chains/main/blocks/head/context/contracts/" + contract_address;
  const c = await rpcGet(uri);
  for (let i = 0; i < c.script.code.length; ++i) {
    const p = c.script.code[i];
    if (p.prim == "view" && p.args[0].string == viewid) {
      return p.args[2]
    }
  }
  throw new Error(`Error: view "${viewid}" not found.`)
}

async function runView(options) {
  const viewid = options.viewid;
  const contractid = options.contract;
  const json = options.json;
  const taquito_schema = options.taquito_schema === undefined ? false : options.taquito_schema;

  let jarg;
  if (options.arg) {
    jarg = expr_micheline_to_json(options.arg)
  } else if (options.argMichelson) {
    jarg = expr_micheline_to_json(options.argMichelson)
  } else if (options.argJsonMichelson) {
    jarg = expr_micheline_to_json(json_micheline_to_expr(options.argJsonMichelson));
  } else {
    jarg = expr_micheline_to_json("Unit")
  }

  let contract_address = null;
  if (contractid.startsWith("KT1")) {
    contract_address = contractid;
  } else {
    const contract = getContractFromIdOrAddress(contractid);
    if (!isNull(contract)) {
      contract_address = contract.address;
    }
  }

  if (isNull(contract_address)) {
    const msg = `Contract not found: ${contractid}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const config = getConfig()

  const as = isNull(options.as) ? config.account : options.as;
  const addr = getAddressFromAlias(as)
  let source = isNull(addr) ? as : addr;
  if (!source.startsWith("KT1") && !source.startsWith("tz1") && !source.startsWith("tz2") && !source.startsWith("tz3")) {
    const msg = `Invalid address: ${source}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const chainid = await getChainId();

  const input = {
    "chain_id": chainid,
    "contract": contract_address,
    "view": viewid,
    "unlimited_gas": true,
    "gas": undefined,
    "input": jarg,
    "payer": source,
    "source": source,
    "now": undefined,
    "level": undefined,
    "unparsing_mode": "Readable"
  }

  try {
    const res = await rpcPost("/chains/main/blocks/head/helpers/scripts/run_script_view", input);
    if (res && res.data) {
      if (taquito_schema) {
        const ty = await get_view_return_type(contract_address, viewid);
        return taquitoExecuteSchema(res.data, ty);
      }
      if (json) {
        return res.data;
      }
      return json_micheline_to_expr(res.data);
    } else {
      return new Promise((resolve, reject) => { reject(res) });
    }
  } catch (e) {
  }
  return undefined
}

async function printView(options) {
  runView(options)
    .then(x => {
      print(x)
    })
    .catch(error => {
      print_error(error)
    })
}

async function run(options) {
  const path = options.path;
  const arg = options.argMichelson !== undefined ? options.argMichelson : "Unit";
  const entry = options.entry !== undefined ? options.entry : "default";
  const trace = options.trace === undefined ? false : options.trace;
  const verbose = options.verbose === undefined ? false : options.verbose;

  const amount = isNull(options.amount) ? 0 : getAmount(options.amount);
  if (isNull(amount)) {
    const msg = `Invalid amount`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let michelson_path = null;
  let d_storage = options.storage;
  if (path.endsWith('tz')) {
    michelson_path = path
    if (d_storage === undefined) {
      d_storage = 'Unit'
    }
  } else {
    const tmp = require('tmp');
    const tmpobj = tmp.fileSync();

    const script_raw = await callArchetype(options, path, { target: "michelson" }); // TODO: handle parameters
    const d_path_script = tmpobj.name;
    fs.writeFileSync(d_path_script, script_raw);

    if (d_storage === undefined) {
      d_storage = await callArchetype(options, path, { target: "michelson-storage" });
    }
    michelson_path = tmpobj.name;
  }

  const d_amount = (amount / 1000000).toString();

  const args = [
    "run", "script", michelson_path, "on", "storage", d_storage, "and", "input", arg, "--entrypoint", entry, "--amount", d_amount
  ];
  if (trace) {
    args.push("--trace-stack");
  }
  if (verbose) {
    print(args);
  }
  const { stdout, stderr, failed } = await callTezosClient(args);
  if (failed) {
    return new Promise((resolve, reject) => { reject(stderr) });
  } else {
    print(stdout);
  }
  return new Promise(resolve => { resolve(null) });
}

async function computeArg(args, paramType) {
  const michelsonData = build_data_michelson(paramType, {}, args);
  return michelsonData;
}

async function isContractExists(contract_address) {
  const uri = "/chains/main/blocks/head/context/contracts/" + contract_address;
  const res = await rpcGet(uri);
  return res !== undefined;
}

async function getContractScript(contract_address) {
  const uri = '/chains/main/blocks/head/context/contracts/' + contract_address + '/script';
  const res = await rpcGet(uri);
  return res;
}

async function getParamTypeEntrypoint(entry, contract_address) {
  const uri = "/chains/main/blocks/head/context/contracts/" + contract_address + "/entrypoints";
  const res = await rpcGet(uri);
  const a = res.entrypoints[entry];
  if (!isNull(a)) {
    return a;
  } else if (entry === "default") {
    const s = await getContractScript(contract_address);
    const p = s.code.find(x => x.prim === "parameter");
    const t = p.args[0];
    return t;
  }
}

async function exprMichelineFromArg(arg, type) {
  objValues = {};
  const res = await computeArg(arg, type);
  return res;
}

function taquitoExecuteSchema(data, type) {
  const schema = new encoder.Schema(type);
  const r = schema.Execute(data);
  return r;
}

function isEmptyObject(obj) {
  if (typeof obj === 'object' && obj != null && Object.keys(obj).length !== 0) {
    return false;
  } else {
    return true;
  }
}

async function callContract(options) {
  const input = options.contract;
  const args = options.arg !== undefined && !isEmptyObject(options.arg) ? options.arg : (options.iargs !== undefined ? JSON.parse(options.iargs) : { prim: "Unit" });
  var argJsonMichelson = options.argJsonMichelson;
  var argMichelson = options.argMichelson;
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

  const e = await isContractExists(contract_address);
  if (!e) {
    const msg = `'${contract_address}' not found on ${config.tezos.network}.`;
    throw new Error(msg);
  }

  const paramType = await getParamTypeEntrypoint(entry, contract_address);
  if (isNull(paramType)) {
    const msg = `'${entry}' entrypoint not found.`;
    throw new Error(msg);
  }

  if (argJsonMichelson !== undefined) {
    arg = expr_micheline_to_json(json_micheline_to_expr(argJsonMichelson));
  } else if (argMichelson !== undefined) {
    arg = expr_micheline_to_json(argMichelson);
  } else {
    arg = await computeArg(args, paramType);
  }
  const res = await callTransfer(options, contract_address, arg);
  return res;
}

async function setNow(options) {
  const vdate = options.date;

  return await callContract({ ...options, entry: "_set_now", args: { "": vdate } });
}

function setMockupNow(options) {
  if (!isMockupMode()) {
    throw (new Error("Mode mockup is required for setMockupNow."))
  }
  const date = options.date;
  const value = options.value;

  let d;
  if (date) {
    if (typeof date == "number") {
      if (date > 253400000000) {
        throw new Error("Invalid value (expecting timestamp in seconds)");
      }
      d = new Date(Math.floor(date) * 1000)
    } else {
      d = date
    }
  } else {
    if (value === undefined) {
      throw new Error("No value for setMockupNow");
    }
    d = new Date(value);
  }
  d.setMilliseconds(0);
  d.setSeconds(d.getSeconds() - 1)
  const v = d.toISOString();

  const input = loadJS(context_mockup_path);
  input.context.shell_header.timestamp = v;
  const content = JSON.stringify(input, 0, 2);
  fs.writeFileSync(context_mockup_path, content);
  print("Set mockup now: " + v)
}

function getMockupNow() {
  const input = loadJS(context_mockup_path);
  const d = new Date(input.context.shell_header.timestamp)
  d.setSeconds(d.getSeconds() + 1)
  return d
}

function setMockupLevel(options) {
  if (!isMockupMode()) {
    throw (new Error("Mode mockup is required for setMockupLevel."))
  }
  const value = options.value;

  const input = loadJS(context_mockup_path);
  input.context.shell_header.level = value;
  const content = JSON.stringify(input, 0, 2);
  fs.writeFileSync(context_mockup_path, content);
  print("Set mockup level: " + value)
}

function getMockupLevel() {
  const input = loadJS(context_mockup_path);
  return input.context.shell_header.level
}

function setMockupChainId(options) {
  if (!isMockupMode()) {
    throw (new Error("Mode mockup is required for setMockupChainId."))
  }
  const value = options.value;

  const input = loadJS(context_mockup_path);
  input.chain_id = value;
  const content = JSON.stringify(input, 0, 2);
  fs.writeFileSync(context_mockup_path, content);
  print("Set mockup chain_id: " + value)
}

async function mockupBake(options) {
  if (!isMockupMode()) {
    throw (new Error("Mode mockup is required for mockupBake."))
  }

  const as = isNull(options.as) ? "bootstrap1" : options.as;
  const verbose = options.verbose;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    const msg = `Account '${as}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const args = [
    "bake", "for", account.pkh, "--minimal-timestamp"
  ];
  if (verbose) {
    print(args);
  }
  const { stdout, stderr, failed } = await callTezosClient(args);
  if (failed) {
    return new Promise((resolve, reject) => { reject(stderr) });
  } else {
    print(stdout);
  }
  return new Promise(resolve => { resolve(null) });
}

async function generateCodeGen(options, target) {
  const value = options.path;
  const parameters = options.iparameters !== undefined ? JSON.parse(options.iparameters) : options.parameters;
  const parametersMicheline = options.iparametersMicheline !== undefined ? JSON.parse(options.iparametersMicheline) : options.iparametersMicheline;
  const json = options.json || false;

  const contract = getContract(value);

  var file = value;
  if (!isNull(contract)) {
    file = contract.source;
  }

  if (!fs.existsSync(file)) {
    print(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }
  let code = await callArchetype(options, file, {
    target: target,
    json: json
  });

  const with_parameters = await callArchetype(options, file, {
    with_parameters: true
  });
  if (with_parameters !== "") {
    const contract_parameter = JSON.parse(with_parameters);
    code = process_code_const(code, parameters, parametersMicheline, contract_parameter);
  }

  print(code);
}

async function generateMichelson(options) {
  await generateCodeGen(options, 'michelson')
}

async function generateJavascript(options) {
  await generateCodeGen(options, 'javascript')
}

async function generate_gen(options, a) {
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

  try {
    const res = await callArchetype(options, x, a);
    return res
  } catch (e) {
    return null
  }
}

async function generate_target(options, target) {
  return await generate_gen(options, {
    target: target
  })
}

async function print_generate_target(options, target) {
  const res = await generate_target(options, target);
  print(res)
}

async function print_generate_whyml(options) {
  await print_generate_target(options, 'whyml')
}

async function print_generate_event_binding_js(options) {
  await print_generate_target(options, 'bindings-js')
}

async function print_generate_event_binding_ts(options) {
  await print_generate_target(options, 'bindings-ts')
}

async function generate_unit_binding_ts(ipath, target, with_dapp_originate) {
  try {
    const is_michelson = ipath.endsWith(".tz");
    const dir_path = path.dirname(ipath) + '/';
    const contract_interface = await generate_contract_interface({ path: ipath }, is_michelson);
    if (isNull(contract_interface)) {
      return null;
    }
    const json = JSON.parse(contract_interface);
    let settings = {
      language: is_michelson ? binderTs.Language.Michelson : binderTs.Language.Archetype,
      target: target,
      path: dir_path
    }
    if (with_dapp_originate && target == binderTs.Target.Dapp && !is_michelson) {
      const input = await callArchetype({}, ipath, {
        target: "michelson",
        compiler_json: true
      });
      if (input) {
        const v_input = JSON.parse(input);
        const mich_code = v_input.code;
        const mich_storage = v_input.storage;
        settings = {
          ...settings,
          with_dapp_originate: with_dapp_originate,
          mich_code: mich_code,
          mich_storage: mich_storage
        }
      }
    }
    const binding = binderTs.generate_binding(json, settings);
    return binding;
  } catch (e) {
    return null
  }
}

async function print_generate_binding_ts_gen(options, target) {
  const input_path = options.input_path;
  const output_path = options.output_path;
  const with_dapp_originate = options.with_dapp_originate;
  if (!isNull(input_path)) {
    if (isNull(output_path)) {
      const msg = `output path not set (--output-path)`;
      return new Promise((resolve, reject) => { reject(msg) });
    }

    const files = glob.sync(`${input_path}/**/*[.arl|.tz]`, null)

    for (let i = 0; i < files.length; i++) {
      const input = files[i];
      if (fs.lstatSync(input).isDirectory()) {
        continue
      }
      if (input.endsWith(".tz")) {
        const file_arl = input.substring(0, input.length - 2) + 'arl';
        if (fs.existsSync(file_arl)) {
          continue
        }
      }
      const output_tmp = input.replace(input_path, output_path);
      const output = path.format({ ...path.parse(output_tmp), base: '', ext: '.ts' })

      const content = await generate_unit_binding_ts(input, target, with_dapp_originate)
      if (isNull(content)) {
        print_error(`Invalid file ${input}`);
        continue;
      }

      const output_dir = path.dirname(output);

      if (!fs.existsSync(path)) {
        fs.mkdirSync(output_dir, { recursive: true });
      }

      fs.writeFileSync(output, content);
      print(`Wrote ${output}`);
    }
  } else {
    const res = await generate_unit_binding_ts(options.path, target, with_dapp_originate);
    print(res)
  }
}

async function print_generate_binding_ts(options) {
  await print_generate_binding_ts_gen(options, binderTs.Target.Experiment);
}

async function print_generate_binding_dapp_ts(options) {
  await print_generate_binding_ts_gen(options, binderTs.Target.Dapp);
}

async function generate_contract_interface(options, is_michelson) {
  let obj;
  if (is_michelson) {
    obj = {
      contract_interface_michelson: true
    }
  } else {
    obj = {
      contract_interface: true
    }
  }
  return await generate_gen(options, obj)
}

async function print_generate_contract_interface(options) {
  const is_michelson = options.path.endsWith(".tz");
  const res = await generate_contract_interface(options, is_michelson);
  print(res)
}

async function checkMichelson(options) {
  const path = options.path;

  if (!fs.existsSync(path)) {
    print(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }

  let michelson_path = null
  if (path.endsWith('tz')) {
    michelson_path = path
  } else {
    const res = await callArchetype(options, path, {
      target: 'michelson'
    });

    const tmp = require('tmp');
    const tmpobj = tmp.fileSync();

    michelson_path = tmpobj.name;
    fs.writeFileSync(michelson_path, res);
  }

  const args = ["typecheck", "script", michelson_path];
  const { stdout, stderr, failed } = await callTezosClient(args);
  if (failed) {
    throw (stderr)
  } else {
    print(stdout);
  }
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

async function getEntries(input, rjson) {
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

  const script = await getContractScript(contract_address);
  const i = JSON.stringify(script);
  const res = await show_entries_internal(i, rjson);
  return res;
}

async function showEntries(options) {
  const input = options.contract;
  const res = await getEntries(input, false);
  print(res);
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
      throw (new (`Expecting network ${contract.network}. Switch endpoint and retry.`));
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      throw (new Error(`'${contract_address}' bad contract address.`));
    }
  }
  return contract_address;
}

function getAddressFromAlias(input) {
  const contract = getContract(input);
  if (!isNull(contract)) {
    return contract.address;
  }
  const account = getAccount(input);
  if (!isNull(account)) {
    return account.pkh;
  }
  return null;
}

async function showStorage(options) {
  const input = options.value;
  const json = options.json || false;

  const contract_address = getContractAddress(input);

  const storage = await getRawStorage(contract_address);
  if (json) {
    print(JSON.stringify(storage, 0, 2));
  } else {
    print(codec.emitMicheline(storage))
  }
  return;
}

async function showScript(options) {
  const input = options.value;
  const json = options.json || false;

  const contract_address = getContractAddress(input);

  if (isMockupMode()) {
    const script = await getRawScript(contract_address);
    if (json) {
      print(JSON.stringify(script.code, 0, 2));
    } else {
      print(codec.emitMicheline(script.code))
    }
  } else {
    const config = getConfig();
    const tezos_endpoint = config.tezos.endpoint;
    const url = tezos_endpoint + '/chains/main/blocks/head/context/contracts/' + contract_address + '/script';
    var request = require('request');
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        const j = JSON.parse(body);
        if (json) {
          print(JSON.stringify(j.code, 0, 2));
        } else {
          print(codec.emitMicheline(j.code))
        }
      } else {
        print(`Error: ${response.statusCode}`)
      }
    })
  }
  return;
}

async function getTezosContract(input) {
  const contract_address = getContractAddress(input);

  let contract;
  if (isMockupMode() || isForceTezosClient()) {
    contract = { address: contract_address };
  } else {
    const tezos = getTezos();
    contract = await tezos.contract.at(contract_address);
  }
  return contract;
}

async function getRawStorage(contract_address) {
  const uri = "/chains/main/blocks/head/context/contracts/" + contract_address + "/storage";
  const storage = await rpcGet(uri);
  return storage;
}

async function getRawScript(contract_address) {
  const uri = "/chains/main/blocks/head/context/contracts/" + contract_address + "/script";
  const script = await rpcGet(uri);
  return script;
}

async function getStorage(input) {
  const contract_address = getContractAddress(input);
  const data = await getRawStorage(contract_address);
  const s = await getContractScript(contract_address);
  const p = s.code.find(x => x.prim === "storage");
  const storageType = p.args[0];
  const schema = new encoder.Schema(storageType);
  const r = schema.Execute(data);
  return r;
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

  const balance = retrieveBalanceFor(pkh);
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

function getAccountExt(options) {
  const alias = options.alias;
  const account = getAccountFromIdOrAddr(alias);
  if (account !== undefined) {
    return {
      name: account.name,
      pkh: account.pkh,
      pubk: account.pubk,
      sk: account.key.value
    }
  }
}

async function getBalanceFor(options) {
  const value = options.value;

  const account = getAccountFromIdOrAddr(value);
  var pkh = value;
  if (!isNull(account)) {
    pkh = account.pkh;
  }

  var balance = await retrieveBalanceFor(pkh);
  print(`${balance.toNumber() / 1000000} ꜩ`);
}

function packTyped(options) {
  const data = options.data;
  const typ = options.typ;

  const packedBytes = codec.packDataBytes(data, typ).bytes;
  return packedBytes;
}

function pack(options) {
  var value = options.value;
  let data;
  let typ;
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
    typ: typ
  });
}

function blake2b(options) {
  const blake = require('blakejs');
  const value = options.value;
  const blakeHash = blake.blake2b(taquitoUtils.hex2buf(value), null, 32);
  return taquitoUtils.buf2hex(blakeHash);
}

function keccak(options) {
  const keccak = require('keccak');
  const value = options.value;
  const hash = keccak('keccak256').update(value, "hex");
  return hash.digest('hex')
}

async function sign(options) {
  const value = options.value;
  const as = options.as;

  const signer = getSigner(as);
  return await signer.signer.sign(value);
}

async function signFromSk(options) {
  const value = options.value;
  const sk = options.sk;

  const s = new signer.InMemorySigner(sk);
  return await s.sign(value);
}

function setQuiet(v) {
  settings_quiet = v;
}

function commandNotFound(options) {
  print("commandNotFound: " + options.command);
  help(options);
  return 1;
}

async function getValueFromBigMap(id, data, type, type_value) {
  const input = packTyped({ data: data, typ: type });
  const expr = taquitoUtils.encodeExpr(input);
  try {
    const res = await rpcGet("/chains/main/blocks/head/context/big_maps/" + id + "/" + expr);
    if (type_value !== undefined) {
      const schema = new encoder.Schema(type_value);
      return schema.Execute(res);
    } else {
      return res;
    }
  } catch (e) {
    return null;
  }
}

async function setArchetypeBin(options) {
  const value = options.value;
  const config = getConfig();
  config.archetype_from_bin = (value === 'true');
  saveConfig(config, x => { print(`archetype bin is ${value}`) });
}

function saveLog(log) {
  saveFile(log_path, log);
}

function writeEmptyLog() {
  const input = {
    log: []
  }

  saveLog(input);
}

function isLogMode() {
  const config = getConfig();

  return config && config.log_mode
}

function getLog() {
  const log = loadJS(log_path);
  return log;
}

function addLog(data) {
  const log = getLog()

  log.log.push(data);

  saveLog(log)
}


function initLogData(kind, input) {
  let command = "";
  if (input.args_command) {
    input.args_command.forEach(x => {
      const y = x.includes(' ') || x.includes('"') ? `'${x}'` : x
      command += " " + y
    })
  }
  command = command.trim()

  const data = {
    kind: kind,
    date: new Date().toISOString(),
    command: command,
    stdout: input.stdout,
    stderr: input.stderr,
    failed: input.failed,
  }

  return data;
}

function extractUpdatedStorage(input) {
  const rx = /.*\Updated storage: (.*).*/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}

function extractStorageSize(input) {
  const rx = /.*\Storage size: (.*) bytes/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}

function extractConsumedGas(input) {
  const rx = /.*\Consumed gas: (.*)/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}

function extractPaidStorageSizeDiff(input) {
  const rx = /.*\Paid storage size diff: (.*) bytes/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}



function extractOperationHash(input) {
  const rx = /.*\Operation hash is '(.*)'.*/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}

function extractFailData(input) {
  const rx = /.*\with (.*)/g;
  const arr = rx.exec(input);
  if (!isNull(arr)) {
    const res = unescape(arr[1]);
    return res
  } else {
    return null
  }
}

exports.extract = extractFailData

function addLogAs(data, source) {
  const account = getAccountFromIdOrAddr(source)
  if (account && account.name) {
    data = { ...data, as: account.name }
  }
  return data
}

function addLogOrigination(input) {
  let data = initLogData('origination', input);
  data = {
    ...data,
    amount: input.amount,
    storage: input.storage,
    source: input.source,
    amount: input.amount,
    storage: input.storage,
  }

  data = addLogAs(data, input.source)

  if (!input.failed && input.stdout) {
    const output = input.stdout;

    data = {
      ...data,
      operation: extractOperationHash(output),
      storage_size: extractStorageSize(output),
      consumed_gas: extractConsumedGas(output),
      paid_storage_size_diff: extractPaidStorageSizeDiff(output),
    }
  }

  addLog(data)
}

function addLogTransaction(input) {
  let data = initLogData('transaction', input);
  data = {
    ...data,
    entrypoint: input.entrypoint,
    amount: input.amount,
    arg: input.arg,
    entrypoint: input.entrypoint,
    source: input.source,
    amount: input.amount,
    destination: input.contract_address,
    arg_completium: input.arg_completium
  }

  data = addLogAs(data, input.source)

  if (input.failed && input.stderr) {
    const stderr = input.stderr;

    data = {
      ...data,
      "fail": extractFailData(stderr)
    }
  }

  if (!input.failed && input.stdout) {
    const output = input.stdout;

    data = {
      ...data,
      operation: extractOperationHash(output),
      updated_storage: extractUpdatedStorage(output),
      storage_size: extractStorageSize(output),
      consumed_gas: extractConsumedGas(output)
    }
  }

  addLog(data)
}

async function logEnable(options) {
  const config = getConfig();

  writeEmptyLog();

  config.log_mode = true;
  saveConfig(config, x => { print(`Logging is enabled.`) })
}

async function logDisable(options) {
  const config = getConfig();

  config.log_mode = false;
  saveConfig(config, x => { print(`Logging is disabled.`) })
}

async function confirmLogClear(force) {
  if (force) { return true }
  return new Promise(resolve => { askQuestionBool(`Are you sure to clear log ?`, answer => { resolve(answer); }) });
}

async function logClear(options) {
  const force = options.force;

  const confirm = await confirmLogClear(force);
  if (!confirm) {
    return;
  }

  writeEmptyLog();

  print(`Log is cleared.`)
}

async function logDump(options) {
  const log = getLog()
  print(JSON.stringify(log, 0, 2))
}

const gen_contract_template = name => `
archetype hello

variable s : string = ""

entry exec() {
  s := "Hello Archetype World!"
}
`

const gen_run_test = name => `
#! /bin/sh

if [ $# -eq 0 ]; then
  ts-mocha --timeout 0 --slow 99999999999999999 ./tests/*.ts
else
  ts-mocha --timeout 0 --slow 99999999999999999 ./tests/$1.ts
fi
`

const gen_test_template = name => `
import {get_account, reset_experiment, set_mockup, set_mockup_now} from "@completium/experiment-ts";

import { hello } from './binding/hello'

const assert = require('assert')

/* Accounts ---------------------------------------------------------------- */

const alice = get_account('alice');

/* Initialisation ---------------------------------------------------------- */

describe('Initialisation', async () => {
  it('Reset experiment', async () => {
    await reset_experiment({
      account: 'alice',
      endpoint: 'mockup',
      quiet: true,
    });
  });
  it('set_mockup', async () => {
    set_mockup()
    // await mockup_init()
  });
  it('set_mockup_now', async () => {
    set_mockup_now(new Date(Date.now()))
  });
})

/* Scenario ---------------------------------------------------------------- */

describe('[HELLO] Contract deployment', async () => {
  it('Deploy test_binding', async () => {
    await hello.deploy({ as: alice })
  });
})

describe('[HELLO] Call entry', async () => {
  it("Call 'myentry'", async () => {
    const s_before = await hello.get_s()
    assert(s_before === "")
    await hello.exec({ as : alice })
    const s_after = await hello.get_s()
    assert(s_after === "Hello Archetype World!")
  })
})
`

const gen_package_json = (name, versions) => `
{
  "name": "${name}",
  "version": "1.0.0",
  "scripts": {
    "test": "./run_test.sh",
    "gen-binding": "completium-cli run binder-ts",
    "completium_init": "completium-cli init",
    "mockup_init": "completium-cli mockup init"
  },
  "dependencies": {
    "@completium/archetype-ts-types": "${versions.archetype_ts_types}",
    "@completium/completium-cli": "${versions.completium_cli}",
    "@completium/experiment-ts": "${versions.experiment_ts}"
  },
  "devDependencies": {
    "@types/expect": "${versions.types_expect}",
    "@types/mocha": "${versions.types_mocha}",
    "@types/node": "${versions.types_node}",
    "ts-mocha": "${versions.ts_mocha}",
    "typescript": "${versions.typescript}"
  },
  "completium": {
    "binding_path": "./tests/binding/",
    "build_path": "./build/",
    "contracts_path": "./contracts/",
    "tests_path": "./tests/"
  }
}
`

const gen_tsconfig = () => `
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig.json to read more about this file */

    /* Projects */
    // "incremental": true,                              /* Enable incremental compilation */
    // "composite": true,                                /* Enable constraints that allow a TypeScript project to be used with project references. */
    // "tsBuildInfoFile": "./",                          /* Specify the folder for .tsbuildinfo incremental compilation files. */
    // "disableSourceOfProjectReferenceRedirect": true,  /* Disable preferring source files instead of declaration files when referencing composite projects */
    // "disableSolutionSearching": true,                 /* Opt a project out of multi-project reference checking when editing. */
    // "disableReferencedProjectLoad": true,             /* Reduce the number of projects loaded automatically by TypeScript. */

    /* Language and Environment */
    "target": "ES6",                                     /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "jsx": "preserve",                                /* Specify what JSX code is generated. */
    // "experimentalDecorators": true,                   /* Enable experimental support for TC39 stage 2 draft decorators. */
    // "emitDecoratorMetadata": true,                    /* Emit design-type metadata for decorated declarations in source files. */
    // "jsxFactory": "",                                 /* Specify the JSX factory function used when targeting React JSX emit, e.g. 'React.createElement' or 'h' */
    // "jsxFragmentFactory": "",                         /* Specify the JSX Fragment reference used for fragments when targeting React JSX emit e.g. 'React.Fragment' or 'Fragment'. */
    // "jsxImportSource": "",                            /* Specify module specifier used to import the JSX factory functions when using 'jsx: react-jsx*'. */
    // "reactNamespace": "",                             /* Specify the object invoked for 'createElement'. This only applies when targeting 'react' JSX emit. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    // "useDefineForClassFields": true,                  /* Emit ECMAScript-standard-compliant class fields. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    "rootDir": "./",                                     /* Specify the root folder within your source files. */
    // "moduleResolution": "node",                       /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    // "typeRoots": [],                                  /* Specify multiple folders that act like './node_modules/@types'. */
    // "types": [],                                      /* Specify type package names to be included without being referenced in a source file. */
    // "allowUmdGlobalAccess": true,                     /* Allow accessing UMD globals from modules. */
    // "resolveJsonModule": true,                        /* Enable importing .json files */
    // "noResolve": true,                                /* Disallow 'import's, 'require's or '<reference>'s from expanding the number of files TypeScript should add to a project. */

    /* JavaScript Support */
    // "allowJs": true,                                  /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    // "checkJs": true,                                  /* Enable error reporting in type-checked JavaScript files. */
    // "maxNodeModuleJsDepth": 1,                        /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    // "emitDeclarationOnly": true,                      /* Only output d.ts files and not JavaScript files. */
    "sourceMap": true,                                   /* Create source map files for emitted JavaScript files. */
    // "outFile": "./",                                  /* Specify a file that bundles all outputs into one JavaScript file. If 'declaration' is true, also designates a file that bundles all .d.ts output. */
    "outDir": "../build",                                /* Specify an output folder for all emitted files. */
    // "removeComments": true,                           /* Disable emitting comments. */
    // "noEmit": true,                                   /* Disable emitting files from a compilation. */
    // "importHelpers": true,                            /* Allow importing helper functions from tslib once per project, instead of including them per-file. */
    // "importsNotUsedAsValues": "remove",               /* Specify emit/checking behavior for imports that are only used for types */
    // "downlevelIteration": true,                       /* Emit more compliant, but verbose and less performant JavaScript for iteration. */
    // "sourceRoot": "",                                 /* Specify the root path for debuggers to find the reference source code. */
    // "mapRoot": "",                                    /* Specify the location where debugger should locate map files instead of generated locations. */
    // "inlineSourceMap": true,                          /* Include sourcemap files inside the emitted JavaScript. */
    // "inlineSources": true,                            /* Include source code in the sourcemaps inside the emitted JavaScript. */
    // "emitBOM": true,                                  /* Emit a UTF-8 Byte Order Mark (BOM) in the beginning of output files. */
    // "newLine": "crlf",                                /* Set the newline character for emitting files. */
    // "stripInternal": true,                            /* Disable emitting declarations that have '@internal' in their JSDoc comments. */
    // "noEmitHelpers": true,                            /* Disable generating custom helper functions like '__extends' in compiled output. */
    // "noEmitOnError": true,                            /* Disable emitting files if any type checking errors are reported. */
    // "preserveConstEnums": true,                       /* Disable erasing 'const enum' declarations in generated code. */
    // "declarationDir": "./",                           /* Specify the output directory for generated declaration files. */
    // "preserveValueImports": true,                     /* Preserve unused imported values in the JavaScript output that would otherwise be removed. */

    /* Interop Constraints */
    // "isolatedModules": true,                          /* Ensure that each file can be safely transpiled without relying on other imports. */
    // "allowSyntheticDefaultImports": true,             /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    // "preserveSymlinks": true,                         /* Disable resolving symlinks to their realpath. This correlates to the same flag in node. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */
    // "noImplicitAny": true,                            /* Enable error reporting for expressions and declarations with an implied 'any' type.. */
    // "strictNullChecks": true,                         /* When type checking, take into account 'null' and 'undefined'. */
    // "strictFunctionTypes": true,                      /* When assigning functions, check to ensure parameters and the return values are subtype-compatible. */
    // "strictBindCallApply": true,                      /* Check that the arguments for 'bind', 'call', and 'apply' methods match the original function. */
    // "strictPropertyInitialization": true,             /* Check for class properties that are declared but not set in the constructor. */
    // "noImplicitThis": true,                           /* Enable error reporting when 'this' is given the type 'any'. */
    // "useUnknownInCatchVariables": true,               /* Type catch clause variables as 'unknown' instead of 'any'. */
    // "alwaysStrict": true,                             /* Ensure 'use strict' is always emitted. */
    // "noUnusedLocals": true,                           /* Enable error reporting when a local variables aren't read. */
    // "noUnusedParameters": true,                       /* Raise an error when a function parameter isn't read */
    // "exactOptionalPropertyTypes": true,               /* Interpret optional property types as written, rather than adding 'undefined'. */
    // "noImplicitReturns": true,                        /* Enable error reporting for codepaths that do not explicitly return in a function. */
    // "noFallthroughCasesInSwitch": true,               /* Enable error reporting for fallthrough cases in switch statements. */
    // "noUncheckedIndexedAccess": true,                 /* Include 'undefined' in index signature results */
    // "noImplicitOverride": true,                       /* Ensure overriding members in derived classes are marked with an override modifier. */
    // "noPropertyAccessFromIndexSignature": true,       /* Enforces using indexed accessors for keys declared using an indexed type */
    // "allowUnusedLabels": true,                        /* Disable error reporting for unused labels. */
    // "allowUnreachableCode": true,                     /* Disable error reporting for unreachable code. */

    /* Completeness */
    // "skipDefaultLibCheck": true,                      /* Skip type checking .d.ts files that are included with TypeScript. */
    "skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  }
}
`
async function createProject(options) {
  const value = options.value;
  const project_name = value;
  const project_path = './' + project_name;
  const contracts_path = project_path + '/contracts';
  const tests_path = project_path + '/tests';
  const contract_path = contracts_path + `/hello.arl`;
  const test_path = tests_path + `/hello.spec.ts`;
  const package_path = project_path + '/package.json'
  const tsconfig_path = project_path + '/tsconfig.json'
  const run_test_path = project_path + `/run_test.sh`;

  fs.mkdirSync(project_path)
  fs.mkdirSync(contracts_path)
  fs.mkdirSync(tests_path)

  fs.writeFileSync(contract_path, gen_contract_template(project_name))
  fs.writeFileSync(test_path, gen_test_template(project_name))
  fs.writeFileSync(package_path, gen_package_json(project_name, {
    archetype_ts_types: 'latest',
    completium_cli: 'latest',
    experiment_ts: 'latest',
    ts_mocha: '^10.0.0',
    types_expect: "^24.3.0",
    types_mocha: '^10.0.0',
    types_node: 'latest',
    typescript: '4.7.4'
  }))
  fs.writeFileSync(tsconfig_path, gen_tsconfig())
  fs.writeFileSync(run_test_path, gen_run_test())
  fs.chmodSync(run_test_path, "755")
  print(`Project ${project_name} is created.`)
}

async function getCompletiumProperty(options) {
  const value = options.value;

  const package_json_path = './package.json';
  if (!fs.existsSync(package_json_path)) {
    const msg = `'./package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const json = JSON.parse(fs.readFileSync(package_json_path, 'utf8'));
  if (!json.completium) {
    const msg = `completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (!json.completium[value]) {
    const msg = `${value} in completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  return json.completium[value];
}

async function printCompletiumProperty(options) {
  const property = await getCompletiumProperty(options);
  print(property)
}

async function runBinderTs(options) {
  const package_json_path = './package.json';
  if (!fs.existsSync(package_json_path)) {
    const msg = `'./package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const json = JSON.parse(fs.readFileSync(package_json_path, 'utf8'));
  if (!json.completium) {
    const msg = `completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (!json.completium.contracts_path) {
    const msg = `contracts_path in completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (!json.completium.binding_path) {
    const msg = `binding_path in completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const contracts_path = json.completium.contracts_path;
  const binding_path = json.completium.binding_path;

  await print_generate_binding_ts({ ...options, input_path: contracts_path, output_path: binding_path })
}

function extract_global_address(input) {
  var rx = /.*Global address: (.)+\n/g;
  var arr = rx.exec(input);
  if (arr == null) {
    return null
  } else {
    if (arr.length > 1) {
      const res = arr[0].trim().substring(16);
      return res
    }
  }
  return null
}

async function registerGlobalConstant(options) {
  const value = options.value;
  const force = options.force;

  const config = getConfig();
  const as = isNull(options.as) ? config.account : options.as;
  const account = getAccountFromIdOrAddr(as);
  if (isNull(account)) {
    const msg = `Account '${as}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const args = ["register", "global", "constant", value, "from", account.pkh, "--burn-cap", "20"];
  const { stdout, stderr, failed } = await callTezosClient(args);
  if (failed) {
    if (!force) {
      throw (stderr)
    } else {
      return {
        status: "error",
        stdout: stdout,
        stderr: stderr
      }
    }
  } else {
    print(stdout);
    const global_address = extract_global_address(stdout);
    return {
      status: "passed",
      global_address: global_address,
      stdout: stdout,
      stderr: stderr
    }
  }
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
      case "install":
        await doInstall(options);
        break;
      case "start_sandbox":
        await startSandbox(options);
        break;
      case "stop_sandbox":
        await stopSandbox(options);
        break;
      case "mockup_init":
        await mockupInit(options);
        break;
      case "mockup_set_now":
        await mockupSetNow(options);
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
      case "set_mode":
        await setMode(options);
        break;
      case "switch_mode":
        await switchMode(options);
        break;
      case "show_mode":
        await showMode(options);
        break;
      case "set_bin_path":
        await setBinPath(options);
        break;
      case "show_bin_path":
        await showBinPath(options);
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
      case "run_getter":
        await printGetter(options);
        break;
      case "run_view":
        await printView(options);
        break;
      case "run_binder_ts":
        await runBinderTs(options);
        break;
      case "run":
        await run(options);
        break;
      case "generate_michelson":
        await generateMichelson(options);
        break;
      case "generate_javascript":
        await generateJavascript(options);
        break;
      case "generate_whyml":
        await print_generate_whyml(options);
        break;
      case "generate_event_binding_js":
        await print_generate_event_binding_js(options);
        break;
      case "generate_event_binding_ts":
        await print_generate_event_binding_ts(options);
        break;
      case "generate_binding_ts":
        await print_generate_binding_ts(options);
        break;
      case "generate_binding_dapp_ts":
        await print_generate_binding_dapp_ts(options);
        break;
      case "generate_contract_interface":
        await print_generate_contract_interface(options);
        break;
      case "check_michelson":
        await checkMichelson(options);
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
      case "show_script":
        await showScript(options);
        break;
      case "get_balance_for":
        await getBalanceFor(options);
        break;
      case "log_enable":
        await logEnable(options);
        break;
      case "log_disable":
        await logDisable(options);
        break;
      case "log_clear":
        await logClear(options);
        break;
      case "log_dump":
        await logDump(options);
        break;
      case "create_project":
        await createProject(options);
        break;
      case "get_completium_property":
        await printCompletiumProperty(options);
        break;
      case "register_global_constant":
        await registerGlobalConstant(options);
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
exports.runGetter = runGetter;
exports.runView = runView;
exports.getStorage = getStorage;
exports.getTezosContract = getTezosContract;
exports.getBalance = getBalance;
exports.exec = exec;
exports.setAccount = setAccount;
exports.setEndpoint = setEndpoint;
exports.getAddress = getAddress;
exports.getAccountExt = getAccountExt;
exports.blake2b = blake2b;
exports.keccak = keccak;
exports.sign = sign;
exports.signFromSk = signFromSk;
exports.pack = pack;
exports.packTyped = packTyped;
exports.setNow = setNow;
exports.transfer = transfer;
exports.getEntries = getEntries;
exports.expr_micheline_to_json = expr_micheline_to_json;
exports.json_micheline_to_expr = json_micheline_to_expr;
exports.setQuiet = setQuiet;
exports.getValueFromBigMap = getValueFromBigMap;
exports.getConfig = getConfig;
exports.exprMichelineFromArg = exprMichelineFromArg;
exports.setMockupNow = setMockupNow;
exports.getMockupNow = getMockupNow;
exports.setMockupLevel = setMockupLevel;
exports.getMockupLevel = getMockupLevel;
exports.getChainId = getChainId;
exports.setMockupChainId = setMockupChainId;
exports.mockupBake = mockupBake;
exports.taquitoExecuteSchema = taquitoExecuteSchema;
exports.generate_contract_interface = generate_contract_interface;
exports.getRawStorage = getRawStorage
exports.exec_batch = exec_batch
exports.getKeysFrom = getKeysFrom
exports.registerGlobalConstant = registerGlobalConstant
exports.mockupInit = mockupInit
