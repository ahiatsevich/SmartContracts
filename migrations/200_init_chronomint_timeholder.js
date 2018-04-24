const TimeHolder = artifacts.require("TimeHolder")
const StorageManager = artifacts.require('StorageManager')
const ContractsManager = artifacts.require("ContractsManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ERC20Manager = artifacts.require("ERC20Manager")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const path = require("path")

module.exports = (deployer, networks, accounts) => {
	deployer.then(async () => {

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
}
