var Rewards = artifacts.require("./Rewards.sol");
const Storage = artifacts.require('./Storage.sol');

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(Rewards, Storage.address, "Deposits"))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Rewards deployed: #done"))
}
