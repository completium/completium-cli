require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    const contract = await completium.getContract('abc');
    // const op = await contract.assign({as: 'guillaume', with:'2'});
    const op = await contract.multi({
      args: {
        a: 4,
        b: "abc",
        c: -8
      },
      as: 'guillaume'
    });
    const storage = await contract.storage();
    console.log(storage);
  } catch (e) {
    console.error(e);
  }
}

test();
