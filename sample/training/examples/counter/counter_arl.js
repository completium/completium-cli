const assert = require('assert');
const { deploy } = require('@completium/completium-cli');

const test = async () => {
    const [counter, _] = await deploy('counter.arl');
    await counter.increment({ });
    const storage = await counter.getStorage();
    const count = storage.toNumber();
    assert(count == 3, "Invalid counter value");
}
test();
