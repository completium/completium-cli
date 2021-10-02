const assert     = require('assert');
const { getAddress, deploy } = require('@completium/completium-cli');

const test = async () => {
    const aliceAddr = getAddress("alice");
    const [charity, _] = await deploy('./sample/training/examples/charity/charity.arl', { parameters : { owner : aliceAddr }});
    await charity.donate({ as : "alice", amount : "10tz" });
    await charity.donate({ as : "bob", amount : "5tz" });
    await charity.collect({ as : "alice", arg : { requestedAmount : "15tz" }});
    const balance = await charity.getBalance()
    assert(balance.toNumber() == 0)
}
test();
