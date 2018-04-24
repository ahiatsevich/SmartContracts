// const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const TimePlatform = artifacts.require("TimePlatform")
const TimeAsset = artifacts.require("TimeAsset")
const TimeAssetProxy = artifacts.require("TimeAssetProxy")
const path = require("path")

module.exports = (deployer, network) => {
	if (network !== "main") {
		deployer.then(async () => {
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
		})
	}
}
