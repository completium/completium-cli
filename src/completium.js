/*!
 * completium-cli <https://github.com/edukera/completium-cli>
 *
 * Copyright (c) 2021, edukera, SAS.
 * Released under the MIT License.
 */

import arg from 'arg';
import inquirer from 'inquirer';
import { deploy, callContract, getStorage } from './main';

module.exports = class Completium {

  constructor() {

  }

  async originate(path, obj) {
    const options = { ...obj, file: path, force: true };
    await deploy(options);
  }

  async call(input, obj) {
    const options = { ...obj, contract: input, force: true };
    await callContract(options);
  }

  async getStorage(contract_id) {
    return getStorage(contract_id);
  }
}
