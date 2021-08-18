require = require('esm')(module /*, options*/);

const { getContract } = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    // const completium = new Completium();
    // await completium.originate('xyz.arl', { init: "(" + alice + ", " + stop + ")", test: true });
    // await completium.originate('./resources/xyz.arl', {
    //   parameters: {
    //     n: 0,
    //     str: 'toto'
    //   },
    //   test: true
    // });
    const contract = await getContract('abc');
    // const op = await contract.assign({as: 'guillaume', with:'2'});
    const op = await contract.multi({
      args: {
        a: 2,
        b: "abc",
        c: -4
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
