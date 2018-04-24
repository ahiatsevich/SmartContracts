const TimeAssetProxy = artifacts.require("TimeAssetProxy")
const ERC20Manager = artifacts.require("ERC20Manager")
const ERC20Interface = artifacts.require("ERC20Interface")
const TimeHolder = artifacts.require("TimeHolder")
const ContractsManager = artifacts.require("ContractsManager")
const TimeHolderWallet = artifacts.require("TimeHolderWallet")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const AssetDonator = artifacts.require("AssetDonator")
const VotingManager = artifacts.require('VotingManager')
const path = require("path")

module.exports = async (deployer, network, accounts) => {
	if (network !== "main") {
		deployer.then(async () => {
			const TIME_SYMBOL = 'TIME'
			const TIME_NAME = 'Time Token'
			const TIME_DESCRIPTION = 'ChronoBank Time Shares'
			const TIME_BASE_UNIT = 8

			const erc20Manager = await ERC20Manager.deployed()
			const timeHolder = await TimeHolder.deployed()

			const oldTimeAddress = await erc20Manager.getTokenAddressBySymbol("TIME")
			await timeHolder.removeListener(oldTimeAddress, VotingManager.address)

			await erc20Manager.setToken(oldTimeAddress, TimeAssetProxy.address, TIME_NAME, TIME_SYMBOL, "", TIME_BASE_UNIT, "", "")

			const time = ERC20Interface.at(TimeAssetProxy.address)
			await time.transfer(AssetDonator.address, 1000000000000)

			const contractsManager = await ContractsManager.deployed()
			await contractsManager.removeContract(timeHolder.address)
			await timeHolder.init(ContractsManager.address, time.address, TimeHolderWallet.address, accounts[0], ERC20DepositStorage.address)
			await timeHolder.addListener(time.address, VotingManager.address)

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Original TIME setup: #done`)
		})
	}
}
