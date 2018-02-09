const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const ERC20Manager = artifacts.require('./ERC20Manager.sol')
const AssetsManager = artifacts.require('./AssetsManager.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')
const RewardsWallet = artifacts.require('./RewardsWallet.sol')

module.exports = function(deployer, network, accounts) {
    //----------
    const LHT_SYMBOL = 'LHT'

    const systemOwner = accounts[0]

    deployer
    .then(() => PlatformsManager.deployed())
    .then(_platformsManager => platformsManager = _platformsManager)
    .then(() => AssetsManager.deployed())
    .then(_manager => assetsManager = _manager)
    .then(() => ERC20Manager.deployed())
    .then(_manager => erc20Manager = _manager)
    .then(() => {
        var platforms = []

        return Promise.resolve()
        .then(async () => {
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
        })
        .then(() => {
            return Promise.resolve()
            .then(() => {
                var tokensPromise = Promise.resolve()
                for (var platformIdx = 0; platformIdx < platforms.length; ++platformIdx) {
                    (function() {
                        let _platformAddr = platforms[platformIdx]
                        tokensPromise = tokensPromise
                        .then(() => platformsManager.detachPlatform(_platformAddr))
                        .then(() => assetsManager.getTokenExtension.call(_platformAddr))
                        .then(_addr => {
                            if (_addr != 0) {
                                return assetsManager.unregisterTokenExtension(_addr)
                            }
                        })
                    })()
                }

                return tokensPromise
            })
        })
    })
    .then(() => erc20Manager.removeTokenBySymbol("LHT"))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Platforms cleanup: #done"))
}
