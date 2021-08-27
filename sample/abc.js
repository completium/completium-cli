require = require('esm')(module /*, options*/);

const { getContract, deploy, call, setEndpoint } = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    // setEndpoint('https://granadanet.smartpy.io');
    // const contract = await getContract('abc');
    const [contract, _] = await deploy('/home/guillaume/archetype/completium-cli/sample/resources/abc.arl', {});
    // const op = await contract.assign({as: 'guillaume', with:'2'});

    // const op = await call('abc', {
    //   entry: 'multi',
    //   arg: {
    //     a: 6,
    //     b: "abc",
    //     c: -8
    //   },
    //   as: 'guillaume'
    // });

    // const op = await contract.multi({
    //   args: {
    //     a: 2,
    //     b: "abc",
    //     c: -4
    //   },
    //   as: 'guillaume'
    // });
    await contract.f({arg:{str: "toto"}});
    console.log("LAAAAAAAAAAAAAAAAAAA")
    const storage = await contract.storage();
    console.log(storage);
  } catch (e) {
    console.error(e);
  }
}

test();
