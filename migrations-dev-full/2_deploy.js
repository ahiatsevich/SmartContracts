const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const ChronoBankAsset = artifacts.require("ChronoBankAsset")
const ChronoBankAssetWithFeeProxy = artifacts.require("ChronoBankAssetWithFeeProxy")
const ChronoBankAssetWithFee = artifacts.require("ChronoBankAssetWithFee")
const SafeMath = artifacts.require('SafeMath')
const StringsLib = artifacts.require('StringsLib')
const SetStorageInterface_v_1_1 = artifacts.require("SetStorageInterface_v_1_1")
const Storage = artifacts.require('Storage')
const StorageInterface = artifacts.require('StorageInterface')
const StorageManager = artifacts.require('StorageManager')
const StorageManagerFactory = artifacts.require('StorageManagerFactory')
const ContractsManager = artifacts.require("ContractsManager")
const UserManager = artifacts.require("UserManager")
const ERC20Manager = artifacts.require("ERC20Manager")
const Roles2Library = artifacts.require("Roles2Library")
const FeatureFeeManager = artifacts.require("FeatureFeeManager")
const TokenFactory = artifacts.require("TokenFactory")
const ChronoBankTokenExtensionFactory = artifacts.require('ChronoBankTokenExtensionFactory')
const ChronoBankPlatformBackendProvider = artifacts.require("ChronoBankPlatformBackendProvider")
const ChronoBankAssetFactory = artifacts.require("ChronoBankAssetFactory")
const ChronoBankAssetWithFeeFactory = artifacts.require("ChronoBankAssetWithFeeFactory")
const ChronoBankAssetBasicFactory = artifacts.require("ChronoBankAssetBasicFactory")
const ChronoBankAssetBasicWithFeeFactory = artifacts.require("ChronoBankAssetBasicWithFeeFactory")
const ChronoBankAssetPausableFactory = artifacts.require("ChronoBankAssetPausableFactory")
const ChronoBankAssetBlacklistableFactory = artifacts.require("ChronoBankAssetBlacklistableFactory")

const ChronoBankAssetBasicLib = artifacts.require("ChronoBankAssetBasicLib")
const ChronoBankAssetBasicWithFeeLib = artifacts.require("ChronoBankAssetBasicWithFeeLib")
const ChronoBankAssetPausableLib = artifacts.require("ChronoBankAssetPausableLib")
const ChronoBankAssetBlacklistableLib = artifacts.require("ChronoBankAssetBlacklistableLib")
const ChronoBankAssetUtils = artifacts.require('ChronoBankAssetUtils')

const AssetsManager = artifacts.require("AssetsManager")
const ChronoBankPlatformFactory = artifacts.require('ChronoBankPlatformFactory')
const PlatformsManager = artifacts.require("PlatformsManager")
const RewardsWallet = artifacts.require("RewardsWallet")
const AssetDonator = artifacts.require("AssetDonator")
const LOCWallet = artifacts.require("LOCWallet")
const LOCManager = artifacts.require("LOCManager")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const TimeHolder = artifacts.require("TimeHolder")
const PendingManager = artifacts.require("PendingManager")
const ExchangeFactory = artifacts.require("ExchangeFactory")
const ExchangeManager = artifacts.require("ExchangeManager")
const WalletsFactory = artifacts.require("WalletsFactory")
const WalletsManager = artifacts.require("WalletsManager")
const PlatformTokenExtensionGatewayManager = artifacts.require("PlatformTokenExtensionGatewayManager")
const PollFactory = artifacts.require('PollFactory')
const PollBackend = artifacts.require('PollBackend')
const PollBackendProvider = artifacts.require('PollBackendProvider')
const VotingManager = artifacts.require('VotingManager')
const TokenManagementInterface = artifacts.require('TokenManagementInterface')
const ChronoBankAssetOwnershipManager = artifacts.require('ChronoBankAssetOwnershipManager')
const ERC20Interface = artifacts.require("ERC20Interface")
const TimePlatform = artifacts.require("TimePlatform")
const TimeAsset = artifacts.require("TimeAsset")
const TimeAssetProxy = artifacts.require("TimeAssetProxy")

const FakeCoin = artifacts.require("FakeCoin")
const FakeCoin2 = artifacts.require("FakeCoin2")
const FakeCoin3 = artifacts.require("FakeCoin3")
const ManagerMock = artifacts.require("ManagerMock")
const AssetsManagerMock = artifacts.require("AssetsManagerMock")
const Stub = artifacts.require("Stub")
const ChronoBankPlatformTestable = artifacts.require("ChronoBankPlatformTestable")
const KrakenPriceTicker = artifacts.require("KrakenPriceTicker")
const FakePriceTicker = artifacts.require("FakePriceTicker")
const Clock = artifacts.require("Clock")

const path = require("path")

const bytes32fromBase58 = require('../test/helpers/bytes32fromBase58')
const eventsHelper = require('../test/helpers/eventsHelper')


module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		await deployer.deploy(MultiEventsHistory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Events History: #done`)
	})
	.then(async () => {
		await deployer.deploy(SafeMath)
		await deployer.deploy(StringsLib)
		await deployer.deploy(ChronoBankAssetUtils)
		await deployer.deploy(SetStorageInterface_v_1_1)

		await deployer.link(SetStorageInterface_v_1_1, [ERC20Manager,])
		await deployer.link(ChronoBankAssetUtils, [ 
			ChronoBankAssetProxy, 
			ChronoBankAssetWithFeeProxy, 

			ChronoBankAssetBasicLib,
			ChronoBankAssetBasicWithFeeLib,
			ChronoBankAssetPausableLib,
			ChronoBankAssetBlacklistableLib,

			TokenFactory,
			ChronoBankAssetBasicFactory,
			ChronoBankAssetBasicWithFeeFactory,
			ChronoBankAssetPausableFactory,
			ChronoBankAssetBlacklistableFactory,
		])
        
        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Libraries deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetBasicLib)
		await deployer.deploy(ChronoBankAssetBasicWithFeeLib)
		await deployer.deploy(ChronoBankAssetPausableLib)
		await deployer.deploy(ChronoBankAssetBlacklistableLib)
	})
	.then(async () => {
		await deployer.deploy(Storage)
		await deployer.deploy(StorageInterface)
		await deployer.deploy(StorageManager)

		const storage = await Storage.deployed()
		await storage.setManager(StorageManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(StorageManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Storage Contracts: #done`)
	})
	.then(async () => {
		/** 
		 	NOTE:
		 	Create a new storage manager specifically for Chronobank Platform.
			It could be fetched from chronoBankPlatform.manager()
		 */
		const storageManager = await StorageManager.new()
		await deployer.deploy(ChronoBankPlatform)
		
		const platform = await ChronoBankPlatform.deployed()
		await platform.setManager(storageManager.address)
		await storageManager.giveAccess(platform.address, "ChronoBankPlatform")
		
		const history = await MultiEventsHistory.deployed()
		await history.authorize(platform.address)
		await platform.setupEventsHistory(history.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankPlatform: #done`)
	})
	.then(async () => {
		if (network !== 'main') {
			const TIME_SYMBOL = 'TIME'
			const TIME_NAME = 'Time Token'
			const TIME_DESCRIPTION = 'ChronoBank Time Shares'

			const BASE_UNIT = 8
			// const IS_REISSUABLE = true
			const IS_NOT_REISSUABLE = false

			const platform = await ChronoBankPlatform.deployed()
			await platform.issueAsset(TIME_SYMBOL, 2000000000000, TIME_NAME, TIME_DESCRIPTION, BASE_UNIT, IS_NOT_REISSUABLE, accounts[0])
			await deployer.deploy(ChronoBankAssetProxy)
			
			const proxy = await ChronoBankAssetProxy.deployed()
			await proxy.init(platform.address, TIME_SYMBOL, TIME_NAME)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetProxy: #done`)
		}
	})
	.then(async () => {
		if (network !== 'main') {
			const ASSET_CRATE = 'TIME'

			const platform = await ChronoBankPlatform.deployed()
			
			await deployer.deploy(ChronoBankAsset, platform.address, ASSET_CRATE)
			
			const asset = await ChronoBankAsset.deployed()
			const storageManager = StorageManager.at(await platform.manager())
			await storageManager.giveAccess(asset.address, ASSET_CRATE)
			await asset.init(ChronoBankAssetProxy.address)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAsset: #done`)
		}
	})
	.then(async () => {
		const LHT_SYMBOL = 'LHT'
		const LHT_NAME = 'Labour-hour Token'
		const LHT_DESCRIPTION = 'ChronoBank Lht Assets'

		const BASE_UNIT = 8
		const IS_REISSUABLE = true
		// const IS_NOT_REISSUABLE = false

		const platform = await ChronoBankPlatform.deployed()

		await platform.issueAsset(LHT_SYMBOL, 0, LHT_NAME, LHT_DESCRIPTION, BASE_UNIT, IS_REISSUABLE, accounts[0])
		await deployer.deploy(ChronoBankAssetWithFeeProxy)

		const proxy = await ChronoBankAssetWithFeeProxy.deployed()
		await proxy.init(ChronoBankPlatform.address, LHT_SYMBOL, LHT_NAME)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetWithFeeProxy: #done`)
	})
	.then(async () => {
		const ASSET_WITH_FEE_CRATE = 'LHT'

		const platform = await ChronoBankPlatform.deployed()
		
		await deployer.deploy(ChronoBankAssetWithFee, platform.address, ASSET_WITH_FEE_CRATE)
		
		const asset = await ChronoBankAssetWithFee.deployed()
		const storageManager = StorageManager.at(await platform.manager())
		await storageManager.giveAccess(asset.address, ASSET_WITH_FEE_CRATE)
		await asset.init(ChronoBankAssetWithFeeProxy.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetWithFee: #done`)
	})
	.then(async () => {
		await deployer.deploy(ContractsManager, Storage.address, 'ContractsManager')
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(ContractsManager.address, 'ContractsManager')

		const contractsManager = await ContractsManager.deployed()
		await contractsManager.addContract(MultiEventsHistory.address, "MultiEventsHistory")
		await contractsManager.addContract(StorageManager.address, "StorageManager")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Contracts Manager: #done`)
	})
	.then(async () => {
		await deployer.deploy(UserManager, Storage.address, 'UserManager')

		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(UserManager.address, 'UserManager')

		const userManager = await UserManager.deployed()
		await userManager.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await userManager.setEventsHistory(history.address)
		await history.authorize(userManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] User Manager: #done`)
	})
	.then(async () => {
		await deployer.deploy(ERC20Manager, Storage.address, "ERC20Manager")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(ERC20Manager.address, 'ERC20Manager')

		const erc20Manager = await ERC20Manager.deployed()
		await erc20Manager.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(erc20Manager.address)
		await erc20Manager.setEventsHistory(history.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(FeatureFeeManager, Storage.address, 'FeatureFeeManager')

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] FeatureFee Manager: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
        await storageManager.giveAccess(FeatureFeeManager.address, 'FeatureFeeManager')

        const featureFeeRegistry = await FeatureFeeManager.deployed()
        await featureFeeRegistry.init(ContractsManager.address
        )
        const history = await MultiEventsHistory.deployed()
        await featureFeeRegistry.setEventsHistory(history.address)
        await history.authorize(featureFeeRegistry.address)

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] FeatureFee Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankTokenExtensionFactory, ContractsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Token Management Extension Factory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(TokenFactory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Token Factory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetFactory)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAsset", ChronoBankAssetFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetFactory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetWithFeeFactory)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAssetWithFee", ChronoBankAssetWithFeeFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetWithFeeFactory: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetBasicFactory, ChronoBankAssetBasicLib.address)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAssetBasic", ChronoBankAssetBasicFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetBasicFactory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetBasicWithFeeFactory, ChronoBankAssetBasicWithFeeLib.address)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAssetBasicWithFee", ChronoBankAssetBasicWithFeeFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetBasicWithFeeFactory: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetPausableFactory, ChronoBankAssetPausableLib.address)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAssetPausable", ChronoBankAssetPausableFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetPausableFactory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankAssetBlacklistableFactory, ChronoBankAssetBlacklistableLib.address)

		const proxyFactory = await TokenFactory.deployed()
		await proxyFactory.setAssetFactory("ChronoBankAssetBlacklistable", ChronoBankAssetBlacklistableFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetBlacklistable deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(AssetsManager, Storage.address, 'AssetsManager')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Assets Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(AssetsManager.address, 'AssetsManager')

		const assetsManager = await AssetsManager.deployed()
		await assetsManager.init(ContractsManager.address, ChronoBankTokenExtensionFactory.address, TokenFactory.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(assetsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Assets Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(StorageManagerFactory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] StorageManager Factory deploy: #done`)
	})
	.then(async () => {
		const SYSTEM_AUTHORITY_CONTRACT_KEYS = [
			"PlatformsManager",
			"AssetsManager",
		]
		const storageManagerFactory = await StorageManagerFactory.deployed()
		await storageManagerFactory.setSystemAuthorityKeys(SYSTEM_AUTHORITY_CONTRACT_KEYS)
	
		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] StorageManager Factory setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankPlatformBackendProvider, ChronoBankPlatform.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBank Platform Backend Provider deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(ChronoBankPlatformFactory, ChronoBankPlatformBackendProvider.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(ChronoBankPlatformFactory.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankPlatform Factory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(PlatformsManager, Storage.address, "PlatformsManager")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platforms Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(PlatformsManager.address, "PlatformsManager")

		const platformsManager = await PlatformsManager.deployed()
		await platformsManager.init(ContractsManager.address, ChronoBankPlatformFactory.address, StorageManagerFactory.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(platformsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platforms Manager setup: #done`)
	})
	.then(async () => {
		if (network !== 'main') {
			await deployer.deploy(AssetDonator)

			const assetDonator = await AssetDonator.deployed()
			await assetDonator.init(ContractsManager.address)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Asset Donator: #done`)
		}
	})
	.then(async () => {
		if (network === 'development' || network === 'test') {
			await deployer.deploy(Stub)
			await deployer.deploy(ChronoBankPlatformTestable)
			await deployer.deploy(FakeCoin)
			await deployer.deploy(FakeCoin2)
			await deployer.deploy(FakeCoin3)
			await deployer.deploy(FakePriceTicker)
			await deployer.deploy(ManagerMock)
			await deployer.deploy(Clock)
			await deployer.deploy(AssetsManagerMock)

			const storageManager = await StorageManager.new() // Create new StorageManager for testable platform to not intersect with original platform
			const testablePlatform = await ChronoBankPlatformTestable.deployed()
			await testablePlatform.setManager(storageManager.address)
			await storageManager.giveAccess(ChronoBankPlatformTestable.address, 'ChronoBankPlatform')

			await deployer.deploy(KrakenPriceTicker, true)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Test Contracts deploy: #done`)
		}
	})
	.then(async () => {
		await deployer.deploy(LOCWallet, Storage.address, 'LOCWallet')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LOC Wallet deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(LOCWallet.address, 'LOCWallet')

		const wallet = await LOCWallet.deployed()
		await wallet.init(ContractsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LOC Wallet setup: #done`)
	})
	.then(async () => {
		// deploy FakeCoin only in non-main networks
		if (network === 'main') {
			console.log("[MIGRATION] [36] Deploy FakeCoin: #skiped, main network")
		}
		else {
			// check whether FakeCoin has been already deployed or not
			if (!FakeCoin.isDeployed()) {
				return deployer.then(async () => {
					await deployer.deploy(FakeCoin)

					console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] FakeCoin deploy: #done`)
				})
			}

			console.log("[MIGRATION] [36] Deploy FakeCoin: #skiped, already deployed")
		}
	})
	.then(async () => {
		await deployer.deploy(LOCManager, Storage.address, 'LOCManager')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LOC Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(LOCManager.address, 'LOCManager')

		const locManager = await LOCManager.deployed()
		await locManager.init(ContractsManager.address, LOCWallet.address)

		const history = await MultiEventsHistory.deployed()
		await locManager.setEventsHistory(history.address)
		await history.authorize(LOCManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LOC Manager setup: #done`)
	})
	.then(async () => {

		await deployer.deploy(RewardsWallet, Storage.address, 'RewardsWallet')
		
		const TIME_SYMBOL = 'TIME'
		const TIME_NAME = 'Time Token'
		const TIME_BASE_UNIT = 8

		//----------
		const LHT_SYMBOL = 'LHT'
		const LHT_NAME = 'Labour-hour Token'
		const LHT_BASE_UNIT = 8

		const systemOwner = accounts[0]

		const erc20Manager = await ERC20Manager.deployed()
		const chronoBankPlatform = await ChronoBankPlatform.deployed()

		if (network !== 'main') {
			const chronoBankAssetProxy = await ChronoBankAssetProxy.deployed()
			await chronoBankPlatform.setProxy(ChronoBankAssetProxy.address, TIME_SYMBOL)
			await chronoBankAssetProxy.proposeUpgrade(ChronoBankAsset.address)
			await erc20Manager.addToken(ChronoBankAssetProxy.address, TIME_NAME, TIME_SYMBOL, "", TIME_BASE_UNIT, "", "")
		}

		const chronoBankAssetWithFeeProxy = await ChronoBankAssetWithFeeProxy.deployed()
		const chronoBankAssetWithFee = await ChronoBankAssetWithFee.deployed()
		await chronoBankPlatform.setProxy(ChronoBankAssetWithFeeProxy.address, LHT_SYMBOL)
		await chronoBankAssetWithFeeProxy.proposeUpgrade(ChronoBankAssetWithFee.address)
		await chronoBankAssetWithFee.setupFee(RewardsWallet.address, 100)
		// await erc20Manager.addToken(ChronoBankAssetWithFeeProxy.address, LHT_NAME, LHT_SYMBOL, "", LHT_BASE_UNIT, "", "")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Setup assets: #done`)
	})
	.then(async () => {
		await deployer.deploy(ERC20DepositStorage, Storage.address, "Deposits")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Deposit Storage deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(ERC20DepositStorage.address, "Deposits")

		const erc20DepositStorage = await ERC20DepositStorage.deployed()
		await erc20DepositStorage.init(ContractsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Deposit Storage setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(TimeHolderWallet, Storage.address, "TimeHolderWallet")

		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(TimeHolderWallet.address, 'Deposits')

		const wallet = await TimeHolderWallet.deployed()
		await wallet.init(ContractsManager.address)

		if (network === "main") {
			//await updatedTimeHolder.setLimitForTokenSymbol("TIME", 100000000);
		}
		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimiHolder Wallet: #done`)
	})
	.then(async () => {
		await deployer.deploy(TimeHolder, Storage.address, 'Deposits')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimeHolder deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(TimeHolder.address, "Deposits")

		const erc20Manager = await ERC20Manager.deployed()
		const timeAddress = await erc20Manager.getTokenAddressBySymbol("TIME")

		const timeHolder = await TimeHolder.deployed()
		await timeHolder.init(ContractsManager.address, timeAddress, TimeHolderWallet.address, accounts[0], ERC20DepositStorage.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(timeHolder.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimeHolder init: #done`)
	})
	.then(async () => {
		await deployer.deploy(PendingManager, Storage.address, 'PendingManager')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Pending Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(PendingManager.address, "PendingManager")

		const pendingManager = await PendingManager.deployed()
		await pendingManager.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await pendingManager.setEventsHistory(history.address)
		await history.authorize(PendingManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Pending Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(ExchangeFactory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Exchange Factory: #done`)
	})
	.then(async () => {
		await deployer.deploy(ExchangeManager, Storage.address, 'ExchangeManager')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Exchange Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(ExchangeManager.address, 'ExchangeManager')

		const exchangeManager = await ExchangeManager.deployed()
		await exchangeManager.init(ContractsManager.address, ExchangeFactory.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(exchangeManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Exchange Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(WalletsFactory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Wallets Factory: #done`)
	})
	.then(async () => {
		await deployer.deploy(WalletsManager, Storage.address, 'WalletsManager')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Wallets Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(WalletsManager.address, 'WalletsManager')

		const manager = await WalletsManager.deployed()
		await manager.init(ContractsManager.address, WalletsFactory.address)

		const events = await MultiEventsHistory.deployed()
		await events.authorize(manager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Wallets Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(PlatformTokenExtensionGatewayManager)

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platform TokenExtension Gateway Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
        await storageManager.giveAccess(PlatformTokenExtensionGatewayManager.address, "TokenExtensionGateway")

        const tokenExtensionManager = await PlatformTokenExtensionGatewayManager.deployed()
        await tokenExtensionManager.init(ContractsManager.address)

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platform TokenExtension Gateway Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(PollFactory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Voting entity Factory deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(PollBackend)
		
		const pollBackend = await PollBackend.deployed()
        await pollBackend.init(ContractsManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Poll Backend deploy: #done`)
	})
	.then(async () => {
		await deployer.deploy(PollBackendProvider)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Poll Backend Provider deploy: #done`)
	})
	.then(async () => {
		const backendProvider = await PollBackendProvider.deployed()
		await backendProvider.setPollBackend(PollBackend.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Poll Backend Provider setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(VotingManager, Storage.address, "VotingManager_v1")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Voting Manager deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(VotingManager.address, "VotingManager_v1")

		const votingManager = await VotingManager.deployed()
		await votingManager.init(ContractsManager.address, PollFactory.address, PollBackendProvider.address)

		const history = await MultiEventsHistory.deployed()
		await votingManager.setEventsHistory(history.address)
		await history.authorize(VotingManager.address)

		const erc20Manager = await ERC20Manager.deployed()
		const timeAddress = await erc20Manager.getTokenAddressBySymbol("TIME")

		console.log(`address - ${timeAddress}, votingManager ${VotingManager.address}`);

		const timeholder = await TimeHolder.deployed()
		await timeholder.addListener(timeAddress, VotingManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Voting Manager setup: #done`)
	})
	.then(async () => {
		await deployer.deploy(Roles2Library, Storage.address, "Roles2Library")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Roles Library deploy: #done`)
	})
	.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(Roles2Library.address, 'Roles2Library')

		const rolesLibrary = await Roles2Library.deployed()
		await rolesLibrary.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(rolesLibrary.address)
		await rolesLibrary.setEventsHistory(history.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Roles Library setup: #done`)
	})
	.then(async () => {

		const LHT_SYMBOL = 'LHT'
		const LHT_NAME = 'Labour-hour Token'
		const LHT_DESCRIPTION = 'ChronoBank Lht Assets'
		const LHT_BASE_UNIT = 8
		const IS_REISSUABLE = true
		const WITH_FEE = true

		const FEE_VALUE = 100 // 1%

		const systemOwner = accounts[0]

		var lhtIconIpfsHash = ""
		if (network !== "test") {
			//https://ipfs.infura.io:5001
			lhtIconIpfsHash = "Qmdhbz5DTrd3fLHWJ8DY2wyAwhffEZG9MoWMvbm3MRwh8V";
		}

		const platformsManager = await PlatformsManager.deployed()
		const assetsManager = await AssetsManager.deployed()

		const createPlatformTx = await platformsManager.createPlatform()
		let platformAddr
		const event = (await eventsHelper.findEvent([platformsManager,], createPlatformTx, "PlatformRequested"))[0]
		if (event === undefined) {
			throw "No event for platform creation was found. Check access rights for platforms manager and asset manager"
		} else {
			platformAddr = event.args.platform
		}

		const tokenExtensionAddr = await assetsManager.getTokenExtension.call(platformAddr)
		const tokenExtension = await TokenManagementInterface.at(tokenExtensionAddr)
		const createLhtResultCode = (await tokenExtension.createAssetWithFee.call(
			LHT_SYMBOL,
			LHT_NAME,
			LHT_DESCRIPTION,
			0,
			LHT_BASE_UNIT,
			IS_REISSUABLE,
			RewardsWallet.address,
			FEE_VALUE,
			bytes32fromBase58(lhtIconIpfsHash)
		)).toNumber()

		if (createLhtResultCode === 1) {
			await tokenExtension.createAssetWithFee(
				LHT_SYMBOL,
				LHT_NAME,
				LHT_DESCRIPTION,
				0,
				LHT_BASE_UNIT,
				IS_REISSUABLE,
				RewardsWallet.address,
				FEE_VALUE,
				bytes32fromBase58(lhtIconIpfsHash)
			)
		}
		else {
			throw `Cannot create token LHT. Result code: + ${createLhtResultCode}`
		}

		const assetOwnershipManagerAddr = await tokenExtension.getAssetOwnershipManager.call()
		const assetOwnershipManager = ChronoBankAssetOwnershipManager.at(assetOwnershipManagerAddr)
		await assetOwnershipManager.addAssetPartOwner(LHT_SYMBOL, LOCWallet.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] PlatformsManager reinit with LHT: #done`)
	})
	.then(async () => {
		if (network !== "main") {
			const TIME_SYMBOL = 'TIME'
			const TIME_NAME = 'Time Token'
			const TIME_DESCRIPTION = 'ChronoBank Time Shares'
			const BASE_UNIT = 8
			const IS_NOT_REISSUABLE = false

			// const history = await MultiEventsHistory.deployed()

			await deployer.deploy(TimePlatform)

			const timePlatform = await TimePlatform.deployed()

			//await history.authorize(timePlatform.address);
			await timePlatform.setupEventsHistory(timePlatform.address)
			console.log(await timePlatform.eventsHistory())

			await timePlatform.issueAsset(TIME_SYMBOL, 71011281080000, TIME_NAME, TIME_DESCRIPTION, BASE_UNIT, IS_NOT_REISSUABLE)

			await deployer.deploy(TimeAssetProxy)
			const proxy = await TimeAssetProxy.deployed()
			await proxy.init(timePlatform.address, TIME_SYMBOL, TIME_NAME)

			await deployer.deploy(TimeAsset)
			const asset = await TimeAsset.deployed()
			await asset.init(proxy.address)

			await timePlatform.setProxy(proxy.address, TIME_SYMBOL)
			await proxy.proposeUpgrade(asset.address)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Original TIME deploy: #done`)
		}
	})
	.then(async () => {
		if (network !== "main") {
			const TIME_SYMBOL = 'TIME'
			const TIME_NAME = 'Time Token'
			const TIME_DESCRIPTION = 'ChronoBank Time Shares'
			const TIME_BASE_UNIT = 8

			const erc20Manager = await ERC20Manager.deployed()
			const timeHolder = await TimeHolder.deployed()

			const oldTimeAddress = await erc20Manager.getTokenAddressBySymbol("TIME")

			const totalTimeShares = (await timeHolder.totalShares(oldTimeAddress)).toNumber()
			await timeHolder.removeListener(oldTimeAddress, VotingManager.address)

			await erc20Manager.setToken(oldTimeAddress, TimeAssetProxy.address, TIME_NAME, TIME_SYMBOL, "", TIME_BASE_UNIT, "", "")

			const time = ERC20Interface.at(TimeAssetProxy.address)
			await time.transfer(AssetDonator.address, 1000000000000)

			const contractsManager = await ContractsManager.deployed();
			await contractsManager.removeContract(timeHolder.address);
			await timeHolder.init(ContractsManager.address, time.address, TimeHolderWallet.address, accounts[0], ERC20DepositStorage.address)
			await timeHolder.addListener(time.address, VotingManager.address)

			if (totalTimeShares > 0) {
				await time.transfer(TimeHolderWallet.address, totalTimeShares)
			}

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Original TIME setup: #done`)
		}
	})
	.then(async () => {
		const userManager = await UserManager.deployed()

		const required = (await userManager.required()).toNumber()
		if (required < 2) {
			const result = (await userManager.setRequired.call(2)).toNumber()
			if (result === 1) {
				await userManager.setRequired(2)
				console.log(`Required now is ${(await userManager.required()).toNumber()}`)
			}
			else {
				console.log(`[WARNING] Required (result ${result}) is still equal to, ${await userManager.required()}`)
			}
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] UserManager update required: #done`)
	})
	.then(async () => {
		const systemUser = accounts[0]
		const rootUser = systemUser
		const middlewareAddresses = [ systemUser, ] // TODO: add more middleware addresses
		const roles = {
			middlewareAuthority: 9,
		}

		const rolesLibrary = await Roles2Library.deployed()
		await rolesLibrary.setRootUser(rootUser, true, { from: systemUser, })

		for (var middlewareAddress of middlewareAddresses) {
			await rolesLibrary.addUserRole(middlewareAddress, roles.middlewareAuthority, { from: rootUser, })
		}

		// Setup role capabilities

		const timeHolder = await TimeHolder.deployed()
		{
			const signature = timeHolder.contract.registerUnlockShares.getData("", 0x0, 0, 0x0, "").slice(0, 10)
			await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
		}
		{
			const signature = timeHolder.contract.unregisterUnlockShares.getData("").slice(0, 10)
			await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Role Capabilities setup: #done`)
	})
	.then(async () => {
		let contractsManager = await ContractsManager.deployed()
		await contractsManager.addContract(accounts[0], "Rewards")
	})
}
