const WalletsManager = artifacts.require("./WalletsManager.sol");
const Storage = artifacts.require('./Storage.sol');

module.exports = function (deployer, network) {
    deployer.deploy(WalletsManager, Storage.address, 'WalletsManager')
        .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] WalletsManager deploy: #done"))
}
