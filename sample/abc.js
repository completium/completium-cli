require = require('esm')(module /*, options*/);

const { getContract, call, setEndpoint } = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    setEndpoint('https://granadanet.smartpy.io');
    const contract = await getContract('abc');
    // const op = await contract.assign({as: 'guillaume', with:'2'});

    const op = await call('abc', {
      entry: 'multi',
      arg: {
        a: 6,
        b: "abc",
        c: -8
      },
      as: 'guillaume'
    });

    // const op = await contract.multi({
    //   args: {
    //     a: 2,
    //     b: "abc",
    //     c: -4
    //   },
    //   as: 'guillaume'
    // });
    const storage = await contract.storage();
    console.log(storage);
  } catch (e) {
    console.error(e);
  }
}

test();
