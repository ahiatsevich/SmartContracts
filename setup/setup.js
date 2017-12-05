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
const VoteActor = artifacts.require("./VoteActor.sol");
const PollManager = artifacts.require("./PollManager.sol");
const PollDetails = artifacts.require("./PollDetails.sol");
const PlatformTokenExtensionGatewayManager = artifacts.require('./PlatformTokenExtensionGatewayManager.sol')
const AssetOwnershipDelegateResolver = artifacts.require('./AssetOwnershipDelegateResolver.sol')
//const CrowdsaleManager = artifacts.require("./CrowdsaleManager.sol");

const contractTypes = {
  LOCManager: "LOCManager", // LOCManager
  PendingManager: "PendingManager", // PendingManager
  UserManager: "UserManager", // UserManager
  ERC20Manager: "ERC20Manager", // ERC20Manager
  ExchangeManager: "ExchangeManager", // ExchangeManager
  TrackersManager: "TrackersManager", // TrackersManager
  Voting: "PollManager", // Voting
  Rewards: "Rewards", // Rewards
  AssetsManager: "AssetsManager", // AssetsManager
  TimeHolder: "TimeHolder", //TimeHolder
  CrowdsaleManager: "CrowdsaleManager",
  VotingActor: "VoteActor",
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
let voteActor
let pollManager
let pollDetails
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
let assetOwnershipDelegateResolver

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
      VoteActor.deployed(),
      PollManager.deployed(),
      PollDetails.deployed(),
      TimeHolder.deployed(),
      TimeHolderWallet.deployed(),
      MultiEventsHistory.deployed(),
      StorageManager.deployed(),
      PlatformTokenExtensionGatewayManager.deployed(),
      AssetOwnershipDelegateResolver.deployed()
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
      voteActor,
      pollManager,
      pollDetails,
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
    module.exports.vote = { manager: pollManager, details: pollDetails, actor: voteActor }
    module.exports.multiEventsHistory = multiEventsHistory
    module.exports.storageManager = storageManager
    module.exports.tokenExtensionGateway = tokenExtensionGateway
    module.exports.assetOwnershipResolver = assetOwnershipDelegateResolver

    //module.exports.crowdsaleManager = crowdsaleManager
  }).then(() => {
    callback()
  }).catch(function (e) {
    console.log("Error:", e)
    callback(e);
  })
}

module.exports.setup = setup
module.exports.contractTypes = contractTypes
