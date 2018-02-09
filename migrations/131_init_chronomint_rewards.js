const Rewards = artifacts.require("./Rewards.sol");
const RewardsWallet = artifacts.require("./RewardsWallet.sol")
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')

module.exports = function (deployer, network, accounts) {
    const systemOwner = accounts[0]

    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.giveAccess(Rewards.address, "Deposits"))
    .then(() => Rewards.deployed())
    .then(_manager => {
        return Promise.resolve()
        .then(() => PlatformsManager.deployed())
        .then(async (platformsManager) => {
            var platforms = []

            return Promise.resolve().then(async () => {
                let platformsCount = await platformsManager.getPlatformsCount.call()
                let allPlatforms = await platformsManager.getPlatforms.call(0, platformsCount)
                let next = Promise.resolve()
                for (var _platformIdx = 0; _platformIdx < allPlatforms.length; ++_platformIdx) {
                    (function() {
                        const _platformAddr = allPlatforms[_platformIdx];
                        next = next.then(async () => {
                            let _platform = await ChronoBankPlatform.at(_platformAddr)
                            let _owner = await _platform.contractOwner.call()
                            if (_owner === systemOwner) {
                                platforms.push(_platformAddr)
                            }
                        })
                    })()
                }
                return next
            }).then(() => platforms[0])
            platformsManager.getPlatformForUserAtIndex.call(systemOwner, 0)
        })
        .then(_platformAddr => _manager.init(ContractsManager.address, RewardsWallet.address, _platformAddr, 0))
    })
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(Rewards.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Rewards setup: #done"))
}
