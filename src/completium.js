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

  async originate(path, obj) {
    const options = { ...obj, file: path, force: true };
    const op = await Main.deploy(options);
    op.cost = this.computeCost(op);
    return op;
  }

  async call(input, obj) {
    const options = { ...obj, contract: input, force: true };
    const op = await Main.callContract(options);
    op.cost = this.computeCost(op);
    return op;
  }

  async getStorage(contract_id) {
    return Main.getStorage(contract_id);
  }

  async getBalance(alias, obj) {
    const options = alias === undefined ? {} : obj === undefined ? { alias: alias } : { ...obj, alias: alias };
    return Main.getBalance(options);
  }
}
