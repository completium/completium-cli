require = require('esm')(module /*, options*/);

const { deploy } = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const [contract, op] = await deploy('./resources/xyz.arl', {
      parameters: {
        n: 0,
        s: 'toto'
      }
    });
    const storage = await contract.storage();
    console.log(storage);
  } catch (e) {
    console.error(e);
  }
}

test();
