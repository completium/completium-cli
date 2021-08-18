/*!
 * completium-cli <https://github.com/edukera/completium-cli>
 *
 * Copyright (c) 2021, edukera, SAS.
 * Released under the MIT License.
 */

// import { deploy, callContract, getStorage } from './main';

const Main = require('./main')

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

async function deploy(path, obj) {
  const options = { ...obj, file: path, force: true, quiet: true };
  var op = await Main.deploy(options);
  op = updateCost(op);
  return op;
}

async function originate(path, obj) {
  const options = { ...obj, file: path, force: true, quiet: true, originate: true };
  var op = await Main.deploy(options);
  op = updateCost(op);
  return op;
}

async function call(input, obj) {
  const options = { ...obj, contract: input, force: true, verbose: true };
  var op = await Main.callContract(options);
  op = updateCost(op);
  return op;
}

async function getStorage(contract_id) {
  return Main.getStorage(contract_id);
}

async function getContract(contract_id) {
  return new Promise(async (resolve, reject) => {
    const contract = await Main.getTezosContract(contract_id);
    const contract_address = contract.address;
    // resolve(contract);

    Main.getEntries(contract_address, true,
      x => {
        const entries = JSON.parse(x);
        const sigs = entries.map(x => x);
        sigs.forEach(sig => {
          const id = sig.name.startsWith("%") ? sig.name.substring(1) : sig.name;
          contract[id] = (settings => call(contract_id, {
            ...settings,
            entry: id
          }))
        });
        resolve(contract);
      });
  });
}

async function getBalance(alias, obj) {
  const options = alias === undefined ? {} : obj === undefined ? { alias: alias } : { ...obj, alias: alias };
  return Main.getBalance(options);
}

async function setAccount(account, obj) {
  const options = obj === undefined ? { account: account, quiet: true } : { ...obj, account: account, quiet: true };
  return Main.setAccount(options);
}

async function setEndpoint(endpoint, obj) {
  const options = obj === undefined ? { endpoint: endpoint, quiet: true } : { ...obj, endpoint: endpoint, quiet: true };
  return Main.setEndpoint(options);
}

function getAddress(alias) {
  const options = { alias: alias };
  return Main.getAddress(options);
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

async function setNow(contract_id, date) {
  const options = { contract: contract_id, date: date, force: true, verbose: true };
  var op = await Main.setNow(options);
  op = updateCost(op);
  return op;
}

async function transfer(from, to, amount) {
  const options = { from: from, to: to, vamount: amount, force: true, verbose: true };
  var op = await Main.transfer(options);
  return op;
}

function formatDate(value) {
  return Main.formatDate(value);
}

exports.deploy = deploy;
exports.originate = originate;
exports.call = call;
exports.getStorage = getStorage;
exports.getContract = getContract;
exports.getBalance = getBalance;
exports.setAccount = setAccount;
exports.setEndpoint = setEndpoint;
exports.getAddress = getAddress;
exports.pack = pack;
exports.packTyped = packTyped;
exports.blake2b = blake2b;
exports.setNow = setNow;
exports.transfer = transfer;
exports.formatDate = formatDate;