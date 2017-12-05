const TimeHolder = artifacts.require("./TimeHolder.sol");
const Storage = artifacts.require('./Storage.sol');
const StorageManager = artifacts.require('./StorageManager.sol');
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const ERC20Manager = artifacts.require("./ERC20Manager.sol");
const ERC20Interface = artifacts.require('ERC20Interface.sol')
const ChronoBankAssetProxy = artifacts.require("./ChronoBankAssetProxy.sol");
const TimeHolderWallet = artifacts.require('./TimeHolderWallet.sol')
const VoteActor = artifacts.require('./VoteActor.sol')

module.exports = function(deployer, network, accounts) {
    const systemOwner = accounts[0]

    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => storageManager = _storageManager)
    .then(() => TimeHolder.deployed())
    .then(_timeHolder => timeHolder = _timeHolder)

    .then(() => storageManager.giveAccess(TimeHolder.address, 'Deposits'))
    .then(() => ERC20Manager.deployed())
    .then(_erc20Manager => _erc20Manager.getTokenAddressBySymbol.call("TIME"))
    .then(_timeAddress => timeHolder.init(ContractsManager.address, _timeAddress, TimeHolderWallet.address, systemOwner))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(timeHolder.address))
    .then(() => timeHolder.addListener(VoteActor.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] TimeHolder setup: #done"))
}
