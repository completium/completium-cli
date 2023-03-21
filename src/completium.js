/*!
 * completium-cli <https://github.com/completium/completium-cli>
 *
 * Copyright (c) 2021-2023, edukera, SAS.
 * Released under the MIT License.
 */

// import { deploy, callContract, getStorage } from './main';

const Main = require('./main');
const assert = require('assert');

const BigNumber = require('bignumber.js').BigNumber;

function computeCost(op) {
  if (op.results !== undefined) {
    var cost = new BigNumber('0');
    op.results.forEach(x => {
      const fee = new BigNumber(x.fee);
      const storage_limit = new BigNumber(x.storage_limit);
      cost = cost.plus(fee.plus(storage_limit.multipliedBy(new BigNumber('250'))))
    });
    return cost;
  } else {
    return null;
  }
}

function updateCost(op) {
  if (op !== undefined && op != null) {
    const cost = computeCost(op);
    return { ...op, cost: cost };
  } else {
    return op;
  }
}

async function deploy(path, obj, originate = false) {
  const options = { ...obj, file: path, force: true, originate: originate };
  const x = await Main.deploy(options);
  if (x == null) {
    return [null, null];
  } else {
    var [contract_id, op] = x;
    if (op != null) {
      op = updateCost(op);
    }
    const contract = await getContract(contract_id)
    return [contract, op];
  }
}

async function originate(path, obj) {
  return await deploy(path, obj, true);
}

async function call(input, obj) {
  const options = { ...obj, contract: input, force: true, verbose: true };
  var op = await Main.callContract(options);
  op = updateCost(op);
  return op;
}

async function runGetter(getterid, contract, options) {
  const obj = options ? options : {};
  return Main.runGetter({...obj, getterid: getterid, contract: contract});
}

async function runView(viewid, contract, options) {
  const obj = options ? options : {};
  return Main.runView({...obj, viewid: viewid, contract: contract});
}

async function getStorage(contract_id) {
  return Main.getStorage(contract_id);
}

async function getContract(contract_id) {
  return new Promise(async (resolve, reject) => {
    let contract = null;
    try {
      contract = await Main.getTezosContract(contract_id);
    } catch (ex) {
      reject(ex)
    }
    const contract_address = contract.address;

    const x = await Main.getEntries(contract_address, true);
    const entries = JSON.parse(x);
    const sigs = entries.map(x => x);
    sigs.forEach(sig => {
      const id = sig.name.startsWith("%") ? sig.name.substring(1) : sig.name;
      if (id === "_set_now") {
        contract['_setNow'] = (x => call(contract_id, {
          arg: { "": x },
          entry: "_set_now"
        }))
      }
      contract[id] = (settings => call(contract_id, {
        ...settings,
        entry: id
      }))
    });
    contract["default"] = (settings => call(contract_id, {
      ...settings,
      entry: "default"
    }));
    contract["getStorage"] = (p => getStorage(contract_id));
    contract["getBalance"] = (p => getBalance(contract_id));
    resolve(contract);
  });
}

async function getBalance(alias, obj) {
  const options = alias === undefined ? {} : obj === undefined ? { alias: alias } : { ...obj, alias: alias };
  return Main.getBalance(options);
}

function setAccount(account, obj) {
  const options = obj === undefined ? { account: account } : { ...obj, account: account };
  return Main.setAccount(options);
}

function setEndpoint(endpoint, obj) {
  const options = obj === undefined ? { endpoint: endpoint } : { ...obj, endpoint: endpoint };
  return Main.setEndpoint(options);
}

function getAddress(alias) {
  const options = { alias: alias };
  return Main.getAddress(options);
}

function getAccount(alias) {
  const options = { alias: alias };
  return Main.getAccountExt(options);
}

function pack(value) {
  const options = { value: value };
  return Main.pack(options);
}

function packTyped(data, typ) {
  const options = { data: data, typ: typ };
  return Main.packTyped(options);
}

function blake2b(value) {
  const options = { value: value };
  return Main.blake2b(options);
}

function keccak(value) {
  const options = { value: value };
  return Main.keccak(options);
}

async function sign(value, obj) {
  const options = {...obj, value: value };
  return await Main.sign(options);
}

async function signFromSk(value, obj) {
  const options = {...obj, value: value };
  return await Main.signFromSk(options);
}

function setQuiet(value) {
  Main.setQuiet(value);
}

async function setNow(contract_id, date) {
  const options = { contract: contract_id, date: date, force: true, verbose: true };
  var op = await Main.setNow(options);
  op = updateCost(op);
  return op;
}

function setMockupNow(date) {
  const options = { date: date, force: true, verbose: true };
  Main.setMockupNow(options);
}

function getMockupNow() {
  return Main.getMockupNow()
}

function setMockupLevel(level) {
  const options = { value: level, force: true, verbose: true };
  Main.setMockupLevel(options);
}

function getMockupLevel() {
  return Main.getMockupLevel()
}

function setMockupChainId(chainid) {
  const options = { value: chainid, force: true, verbose: true };
  Main.setMockupChainId(options);
}

async function mockupBake(obj) {
  const options = {...obj, force: true, verbose: false };
  await await Main.mockupBake(options)
}

async function transfer(from, to, amount) {
  const options = { from: from, to: to, vamount: amount, force: true, verbose: true };
  var op = await Main.transfer(options);
  return op;
}

function expr_micheline_to_json(v) {
  return Main.expr_micheline_to_json(v);
}

function json_micheline_to_expr(v) {
  return Main.json_micheline_to_expr(v);
}

async function checkBalanceDelta(a, d, f) {
  const balance_before = (await (getBalance(a))).toNumber();
  try {
    await f ();
    const balance_after = (await (getBalance(a))).toNumber();
    // After Minus Before
    const delta = balance_after - balance_before;
    const account = getAccount(a);
    const account_id = (account !== undefined && account != null) ? account.name : a;
    const errorMsg = "Invalid delta balance of " + (delta / 1000000) + "XTZ for " + account_id.toString();
    try {
      if (!d((balance_after - balance_before) / 1000000)) {
        throw (new Error(errorMsg))
      }
    } catch (e) {
      if (isNaN(d) || !(typeof d === 'number')) {
        throw e
      } else if (delta !== d * 1000000) {
        throw (new Error(errorMsg))
      }
    }
  } catch (e) {
    throw e
  }
}

async function getValueFromBigMap(id, data, type, type_value) {
  var v = await Main.getValueFromBigMap(id, data, type, type_value);
  return v;
}

async function expectToThrow(f, e) {
  if (e === undefined) {
    throw new Error("expectToThrow: error must be defined")
  }
  const m = "Failed to throw" + e;
  try {
    await f();
    throw new Error(m)
  } catch (ex) {
    if (ex.value) {
      assert(ex.value == e, `${ex.value} instead of ${e}`)
    } else {
      throw ex
    }
  }
}

function getEndpoint() {
  const config = Main.getConfig();
  return config.tezos.endpoint;
}

function isMockup() {
  return getEndpoint() === "mockup";
}

async function exprMichelineFromArg(arg, type) {
  var v = await Main.exprMichelineFromArg(arg, type);
  return v;
}

function taquitoExecuteSchema(arg, type) {
  var v = Main.taquitoExecuteSchema(arg, type);
  return v;
}

async function generateContractInterface(path, options) {
  const obj = options ? options : {};
  const res = await Main.generate_contract_interface({...obj, path: path});
  return JSON.parse(res);
}

async function exec_batch(ts, options) {
  const obj = options ? options : {};
  return await Main.exec_batch(ts, obj);
}

exports.deploy = deploy;
exports.originate = originate;
exports.call = call;
exports.runGetter = runGetter;
exports.runView = runView;
exports.getStorage = getStorage;
exports.getContract = getContract;
exports.getBalance = getBalance;
exports.setAccount = setAccount;
exports.setEndpoint = setEndpoint;
exports.getAddress = getAddress;
exports.getAccount = getAccount;
exports.pack = pack;
exports.packTyped = packTyped;
exports.blake2b = blake2b;
exports.keccak = keccak;
exports.setNow = setNow;
exports.setMockupNow = setMockupNow;
exports.getMockupNow = getMockupNow;
exports.setMockupLevel = setMockupLevel;
exports.getMockupLevel = getMockupLevel;
exports.setMockupChainId = setMockupChainId;
exports.getChainId = Main.getChainId;
exports.mockupBake = mockupBake;
exports.transfer = transfer;
exports.sign = sign;
exports.signFromSk = signFromSk;
exports.exprMichelineToJson = expr_micheline_to_json;
exports.jsonMichelineToExpr = json_micheline_to_expr;
exports.setQuiet = setQuiet;
exports.checkBalanceDelta = checkBalanceDelta;
exports.getValueFromBigMap = getValueFromBigMap;
exports.expectToThrow = expectToThrow;
exports.getEndpoint = getEndpoint;
exports.isMockup = isMockup;
exports.exprMichelineFromArg = exprMichelineFromArg;
exports.taquitoExecuteSchema = taquitoExecuteSchema;
exports.generateContractInterface = generateContractInterface;
exports.getRawStorage = Main.getRawStorage
exports.exec_batch = exec_batch
exports.getKeysFrom = Main.getKeysFrom
exports.registerGlobalConstant = Main.registerGlobalConstant
exports.mockupInit = Main.mockupInit
