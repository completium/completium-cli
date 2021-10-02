const { deploy, expectToThrow, setMockupNow, getAccount } = require('@completium/completium-cli');
const assert = require('assert');

const test = async () => {
  try {
    const bob = getAccount("bob");

    const start = new Date();
    setMockupNow(start);

    const [vistors, _] = await deploy("./sample/training/exercices/4_maps_1/visitors.arl");
    await vistors.register({ as: "bob", arg: { n: "bob" } });

    await vistors.visit({ as: "bob", amount: "5tz" });
    setMockupNow(start.getTime() / 1000 + 10 * 24 * 60 * 60);
    await vistors.visit({ as: "bob", amount: "3tz" });

    const storage = await vistors.getStorage();


    storage.forEach((value, key) => {
      console.log(`The value of the key ${key} is:\n${JSON.stringify(value, null, 2)}.\n`)
    });
    const nbBobVisits = storage.get(bob.pkh).nbvisits.toNumber();
    assert(nbBobVisits == 2);
  } catch (e) {
    console.log(e);
  }
}
test();
