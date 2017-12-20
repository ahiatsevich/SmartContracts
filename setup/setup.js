const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')
const ChronoBankAssetWithFeeProxy = artifacts.require('./ChronoBankAssetWithFeeProxy.sol')
const ChronoBankAsset = artifacts.require('./ChronoBankAsset.sol')
const ChronoBankAssetWithFee = artifacts.require('./ChronoBankAssetWithFee.sol')
const LOCManager = artifacts.require('./LOCManager.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')
const ContractsManager = artifacts.require('./ContractsManager.sol')
const Exchange = artifacts.require('./Exchange.sol')
const ERC20Manager = artifacts.require("./ERC20Manager.sol")
const ExchangeManager = artifacts.require("./ExchangeManager.sol")
const AssetsManager = artifacts.require("./AssetsManager.sol")
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const WalletsManager = artifacts.require("./WalletsManager.sol")
const PendingManager = artifacts.require("./PendingManager.sol")
const TimeHolder = artifacts.require('./TimeHolder.sol')
const TimeHolderWallet = artifacts.require('./TimeHolderWallet.sol')
const Rewards = artifacts.require('./Rewards.sol')
const RewardsWallet = artifacts.require('./RewardsWallet.sol')
const Storage = artifacts.require('./Storage.sol')
const UserManager = artifacts.require("./UserManager.sol")
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const StorageManager = artifacts.require('StorageManager.sol')
const VotingManager = artifacts.require('VotingManager.sol')
const PlatformTokenExtensionGatewayManager = artifacts.require('./PlatformTokenExtensionGatewayManager.sol')
//const CrowdsaleManager = artifacts.require("./CrowdsaleManager.sol");

const contractTypes = {
  LOCManager: "LOCManager", // LOCManager
  PendingManager: "PendingManager", // PendingManager
  UserManager: "UserManager", // UserManager
  ERC20Manager: "ERC20Manager", // ERC20Manager
  ExchangeManager: "ExchangeManager", // ExchangeManager
  TrackersManager: "TrackersManager", // TrackersManager
  // DEPRECATED
  Voting: "PollManager", // Voting
  VotingManager: "VotingManager", // Voting v.2
  Rewards: "Rewards", // Rewards
  AssetsManager: "AssetsManager", // AssetsManager
  TimeHolder: "TimeHolder", //TimeHolder
  CrowdsaleManager: "CrowdsaleManager",
  // DEPRECATED
  VotingActor: "VoteActor",
  // DEPRECATED
  VotingDetails: "PollDetails",
  CrowdsaleManager: "CrowdsaleManager",
  TokenExtensionGateway: "TokenExtensionGateway",
  AssetOwnershipResolver: "AssetOwnershipResolver"
}

let storage
let assetsManager
let platformsManager
let walletsManager
let chronoBankPlatform
let chronoMint
let chronoMintWallet
let contractsManager
let timeHolder
let timeHolderWallet
let shareable
let erc20Manager
let rewards
let rewardsWallet
let votingManager
let userManager
let exchangeManager
let chronoBankAsset
let chronoBankAssetProxy
let chronoBankAssetWithFee
let chronoBankAssetWithFeeProxy
let multiEventsHistory
let storageManager
let crowdsaleManager
let tokenExtensionGateway

let accounts
let params
let paramsGas

var getAcc = function () {
  console.log('setup accounts')
  return new Promise(function (resolve, reject) {
    web3.eth.getAccounts((err, acc) => {
      console.log(acc);
      resolve(acc);
    })
  })
}

var exit = function () {
  process.exit()
}

var setup = function (callback) {
  return getAcc().then(r => {
    accounts = r
    params = {from: accounts[0]}
    paramsGas = {from: accounts[0], gas: 3000000}
    console.log('--done')
  }).then(() => {
    console.log('Instantiate the deployed contracts.')
    return Promise.all([
      Storage.deployed(),
      UserManager.deployed(),
      ContractsManager.deployed(),
      PendingManager.deployed(),
      LOCManager.deployed(),
      LOCWallet.deployed(),
      ChronoBankPlatform.deployed(),
      ChronoBankAsset.deployed(),
      ChronoBankAssetWithFee.deployed(),
      ChronoBankAssetProxy.deployed(),
      ChronoBankAssetWithFeeProxy.deployed(),
      AssetsManager.deployed(),
      PlatformsManager.deployed(),
      WalletsManager.deployed(),
      ERC20Manager.deployed(),
      ExchangeManager.deployed(),
      Rewards.deployed(),
      RewardsWallet.deployed(),
      VotingManager.deployed(),
      TimeHolder.deployed(),
      TimeHolderWallet.deployed(),
      MultiEventsHistory.deployed(),
      StorageManager.deployed(),
      PlatformTokenExtensionGatewayManager.deployed(),
      //CrowdsaleManager.deployed()
    ])
  }).then((instances) => {
    [
      storage,
      userManager,
      contractsManager,
      shareable,
      chronoMint,
      chronoMintWallet,
      chronoBankPlatform,
      chronoBankAsset,
      chronoBankAssetWithFee,
      chronoBankAssetProxy,
      chronoBankAssetWithFeeProxy,
      assetsManager,
      platformsManager,
      walletsManager,
      erc20Manager,
      exchangeManager,
      rewards,
      rewardsWallet,
      votingManager,
      timeHolder,
      timeHolderWallet,
      multiEventsHistory,
      storageManager,
      tokenExtensionGateway,
      assetOwnershipDelegateResolver
      //crowdsaleManager
    ] = instances
  }).then(() => {
    module.exports.storage = storage
    module.exports.accounts = accounts
    module.exports.assetsManager = assetsManager
    module.exports.platformsManager = platformsManager
    module.exports.walletsManager = walletsManager
    module.exports.chronoBankPlatform = chronoBankPlatform
    module.exports.chronoMint = chronoMint
    module.exports.chronoMintWallet = chronoMintWallet
    module.exports.contractsManager = contractsManager
    module.exports.timeHolder = timeHolder
    module.exports.timeHolderWallet = timeHolderWallet
    module.exports.shareable = shareable
    module.exports.erc20Manager = erc20Manager
    module.exports.rewards = rewards
    module.exports.rewardsWallet = rewardsWallet
    module.exports.userManager = userManager
    module.exports.exchangeManager = exchangeManager
    module.exports.chronoBankAsset = chronoBankAsset
    module.exports.chronoBankAssetProxy = chronoBankAssetProxy
    module.exports.chronoBankAssetWithFee = chronoBankAssetWithFee
    module.exports.chronoBankAssetWithFeeProxy = chronoBankAssetWithFeeProxy
    module.exports.votingManager = votingManager // voting v.2
    module.exports.multiEventsHistory = multiEventsHistory
    module.exports.storageManager = storageManager
    module.exports.tokenExtensionGateway = tokenExtensionGateway

    //module.exports.crowdsaleManager = crowdsaleManager
  }).then(() => {
    callback()
  }).catch(function (e) {
    console.log("Error:", e)
    callback(e);
  })
}

let setupPromise = async () => {
    return new Promise((resolve,reject) => {
        setup((e) => {
            if (e === undefined || e === null) {
                resolve()
            } else {
                reject(e)
            }
        })
    })
}

module.exports.setup = setup
module.exports.setupPromise = setupPromise

module.exports.contractTypes = contractTypes
