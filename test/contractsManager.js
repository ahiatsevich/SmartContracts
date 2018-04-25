const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')

contract('Contracts Manager', function(accounts) {
  const owner = accounts[0]
  const owner1 = accounts[1]

  before('setup', async () => {
    await Setup.setupPromise()
  })

  context("initial tests", function() {

    it("can provide ExchangeManager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.ExchangeManager), Setup.exchangeManager.address)
    })

    it("can provide Rewards contract address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.Rewards), Setup.rewards.address)
    })

    it("can provide LOCManager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.LOCManager), Setup.chronoMint.address)
    })

    it("can provide ERC20Manager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.ERC20Manager), Setup.erc20Manager.address)
    })

    it("can provide AssetsManager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.AssetsManager), Setup.assetsManager.address)
    })

    it("can provide UserManager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.UserManager), Setup.userManager.address)
    })

    it("can provide Roles2Library address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.Roles2Library), Setup.rolesLibrary.address)
    })

    it("can provide PendingManager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.PendingManager), Setup.shareable.address)
    })

    it("can provide TimeHolder address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.TimeHolder), Setup.timeHolder.address)
    })

    it("can provide Voting Manager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager), Setup.votingManager.address)
    })    

    it("can provide Token Extension Gateway Manager address.", async () => {
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.TokenExtensionGateway), Setup.tokenExtensionGateway.address)
    })

    it("doesn't allow a non CBE key to change the contract address", async () => {
      await Setup.contractsManager.addContract(Setup.rewards.address, Setup.contractTypes.VotingManager, { from: owner1, })
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager), Setup.votingManager.address)
    })

    it("allows a CBE key to change the contract address", async () => {
      const newAddress = '0x0000000000000000000000000000000000000123'
      await Setup.contractsManager.addContract(newAddress, Setup.contractTypes.VotingManager)
      assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager), newAddress)
    })
  })
})
