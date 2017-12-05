var FakeCoin = artifacts.require("./FakeCoin.sol");
var FakeCoin2 = artifacts.require("./FakeCoin2.sol");
var FakeCoin3 = artifacts.require("./FakeCoin3.sol");
var ManagerMock = artifacts.require("./ManagerMock.sol");
var AssetsManagerMock = artifacts.require("./AssetsManagerMock.sol");
var Stub = artifacts.require("./helpers/Stub.sol");
var ChronoBankPlatformTestable = artifacts.require("./ChronoBankPlatformTestable.sol");
var KrakenPriceTicker = artifacts.require("./KrakenPriceTicker.sol");
var StorageManager = artifacts.require("./StorageManager.sol");
var FakePriceTicker = artifacts.require("./FakePriceTicker.sol");
var Clock = artifacts.require("./Clock.sol");

module.exports = function(deployer,network) {
  if(network === 'development' || network === 'test') {
      deployer.deploy(Stub)
        .then(() => deployer.deploy(ChronoBankPlatformTestable))
        .then(() => deployer.deploy(FakeCoin))
        .then(() => deployer.deploy(FakeCoin2))
        .then(() => deployer.deploy(FakeCoin3))
        .then(() => deployer.deploy(FakePriceTicker))
        .then(() => deployer.deploy(ManagerMock))
        .then(() => deployer.deploy(Clock))
        .then(() => deployer.deploy(AssetsManagerMock))
        .then(() => StorageManager.deployed())
        .then(_storageManager => storageManager = _storageManager)
        .then(() => storageManager.giveAccess(AssetsManagerMock.address, 'AssetsManager'))
        .then(() => deployer.deploy(KrakenPriceTicker, true))
        .then(() => console.log("[MIGRATION] [34] Deploy Test contracts: #done"))
    }
}
