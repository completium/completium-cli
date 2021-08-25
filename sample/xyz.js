require = require('esm')(module /*, options*/);

const { deploy } = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const op = await deploy('./resources/xyz.arl', {
      parameters: {
        n: 0,
        s: 'toto'
      }
      ,test: true
    });
    // const storage = await contract.storage();
    console.log(op);
  } catch (e) {
    console.error(e);
  }
}

test();
