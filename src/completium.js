/*!
 * completium-cli <https://github.com/edukera/completium-cli>
 *
 * Copyright (c) 2021, edukera, SAS.
 * Released under the MIT License.
 */

// import { deploy, callContract, getStorage } from './main';

const Main = require('./main')

const BigNumber = require('bignumber.js').BigNumber;

module.exports = class Completium {

  constructor() {

  }

  computeCost(op) {
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

  updateCost(op) {
    if (op !== undefined && op != null) {
      const cost = this.computeCost(op);
      return {...op, cost: cost};
    } else {
      return op;
    }
  }

  async originate(path, obj) {
    const options = { ...obj, file: path, force: true, quiet: true };
    var op = await Main.deploy(options);
    op = this.updateCost(op);
    return op;
  }

  async call(input, obj) {
    const options = { ...obj, contract: input, force: true, verbose: true };
    var op = await Main.callContract(options);
    op = this.updateCost(op);
    return op;
  }

  async getStorage(contract_id) {
    return Main.getStorage(contract_id);
  }

  async getContract(contract_id) {
    return Main.getContract(contract_id);
  }

  async getBalance(alias, obj) {
    const options = alias === undefined ? {} : obj === undefined ? { alias: alias } : { ...obj, alias: alias };
    return Main.getBalance(options);
  }

  async setAccount(account, obj) {
    const options = obj === undefined ? { account: account, quiet: true } : { ...obj, account: account, quiet: true };
    return Main.setAccount(options);
  }

  async setEndpoint(endpoint, obj) {
    const options = obj === undefined ? { endpoint: endpoint, quiet: true } : { ...obj, endpoint: endpoint, quiet: true };
    return Main.setEndpoint(options);
  }

  getAddress(alias) {
    const options = { alias: alias };
    return Main.getAddress(options);
  }
}
