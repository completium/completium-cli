/*!
 * completium-cli <https://github.com/edukera/completium-cli>
 *
 * Copyright (c) 2021, edukera, SAS.
 * Released under the MIT License.
 */

// import { deploy, callContract, getStorage } from './main';

const Main = require('./main')

module.exports = class Completium {

  constructor() {

  }

  async originate(path, obj) {
    const options = { ...obj, file: path, force: true };
    await Main.deploy(options);
  }

  async call(input, obj) {
    const options = { ...obj, contract: input, force: true };
    await Main.callContract(options);
  }

  async getStorage(contract_id) {
    return Main.getStorage(contract_id);
  }

  async getBalance(alias, obj) {
    const options = alias === undefined ? {} : obj === undefined ? {alias: alias} : { ...obj, alias: alias};
    return Main.getBalance(options);
  }
}
