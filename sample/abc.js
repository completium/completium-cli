require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  const completium = new Completium();
  const contract = await completium.getContract('abc');
  const op = await contract.assign({as: 'guillaume', with:'2'});
  // const op = await contract.multi({
  //   args: {
  //     a : 1,
  //     b : "abc",
  //     c : -2
  //   },
  //   as: 'guillaume'});
  const storage = await contract.storage();
  console.log(storage);
}

test();
