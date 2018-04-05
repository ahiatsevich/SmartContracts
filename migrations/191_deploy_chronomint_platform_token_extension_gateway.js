var PlatformTokenExtensionGatewayManager = artifacts.require("PlatformTokenExtensionGatewayManager")
const path = require("path")

module.exports = deployer => {
    deployer.then(async () => {
        await deployer.deploy(PlatformTokenExtensionGatewayManager)

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platform Token Extension Gateway Manager deploy: #done`)
    })
}
