const ChronoBankAssetWithFee = artifacts.require("./ChronoBankAssetWithFee.sol");
const ChronoBankAsset = artifacts.require("./ChronoBankAsset.sol");
const ChronoBankAssetProxy = artifacts.require("./ChronoBankAssetProxy.sol");
const ChronoBankAssetWithFeeProxy = artifacts.require("./ChronoBankAssetWithFeeProxy.sol");
const AssetsManager = artifacts.require("./AssetsManager.sol");
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const OwnedInterface = artifacts.require('./OwnedInterface')
const Rewards = artifacts.require("./Rewards.sol");
const RewardsWallet = artifacts.require("./RewardsWallet.sol");
const ERC20Manager = artifacts.require("./ERC20Manager.sol");
const LOCManager = artifacts.require('./LOCManager.sol');
const LOCWallet = artifacts.require('./LOCWallet.sol');
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')

const bs58 = require("bs58");
const BigNumber = require("bignumber.js");
const Buffer = require("buffer").Buffer;


module.exports = function(deployer, network, accounts) {
    const TIME_SYMBOL = 'TIME';
    const TIME_NAME = 'Time Token';
    const TIME_DESCRIPTION = 'ChronoBank Time Shares';
    const TIME_BASE_UNIT = 8;

    //----------
    const LHT_SYMBOL = 'LHT';
    const LHT_NAME = 'Labour-hour Token';
    const LHT_DESCRIPTION = 'ChronoBank Lht Assets';
    const LHT_BASE_UNIT = 8;

    const systemOwner = accounts[0]

    deployer
    .then(() => AssetsManager.deployed())
    .then(_assetsManager => assetsManager = _assetsManager)
    .then(() => ERC20Manager.deployed())
    .then(_erc20Manager => erc20Manager = _erc20Manager)
    .then(() => ChronoBankPlatform.deployed())
    .then(_chronoBankPlatform => chronoBankPlatform = _chronoBankPlatform)

    .then(() => {
        if (network !== 'main') {
            return ChronoBankAssetProxy.deployed()
            .then(_chronoBankAssetProxy => chronoBankAssetProxy = _chronoBankAssetProxy)
            .then(() => chronoBankPlatform.setProxy(ChronoBankAssetProxy.address, TIME_SYMBOL))
            .then(() => chronoBankAssetProxy.proposeUpgrade(ChronoBankAsset.address))
            .then(() => erc20Manager.addToken(ChronoBankAssetProxy.address, TIME_NAME, TIME_SYMBOL, "", LHT_BASE_UNIT, "", ""))
        }
    })
    .then(() => {
        return ChronoBankAssetWithFeeProxy.deployed()
            .then(_chronoBankAssetWithFeeProxy => chronoBankAssetWithFeeProxy = _chronoBankAssetWithFeeProxy)
            .then(() => ChronoBankAssetWithFee.deployed())
            .then(_chronoBankAssetWithFee => chronoBankAssetWithFee = _chronoBankAssetWithFee)
            .then(() => chronoBankPlatform.setProxy(ChronoBankAssetWithFeeProxy.address, LHT_SYMBOL))
            .then(() => chronoBankAssetWithFeeProxy.proposeUpgrade(ChronoBankAssetWithFee.address))
            .then(() => chronoBankAssetWithFee.setupFee(RewardsWallet.address, 100))
            .then(() => erc20Manager.addToken(ChronoBankAssetWithFeeProxy.address, LHT_NAME, LHT_SYMBOL, "", LHT_BASE_UNIT, "", ""))
    })

    .then(() => console.log("[MIGRATION] [28] Setup Assets: #done"))
}
