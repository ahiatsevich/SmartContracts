/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;

import "../core/common/Object.sol";
import "../core/lib/SafeMath.sol";
import {ERC20Interface as Asset} from "../core/erc20/ERC20Interface.sol";
import "../core/contracts/ContractsManager.sol";
import "../core/erc20/ERC20Manager.sol";
import "../priceticker/PriceTicker.sol";

contract ExchangeEmitter {
    function emitError(uint errorCode) public;
    function emitFeeUpdated(address rewards, uint feePercent, address by) public;
    function emitPricesUpdated(uint buyPrice, uint sellPrice, bool usePriceTicker, address by) public;
    function emitActiveChanged(bool isActive, address by) public;
    function emitBuy(address who, uint token, uint eth) public;
    function emitSell(address who, uint token, uint eth) public;
    function emitWithdrawEther(address recipient, uint amount, address by) public;
    function emitWithdrawTokens(address recipient, uint amount, address by) public;
    function emitReceivedEther(address sender, uint amount) public;
}

contract IExchangeManager {
    function removeExchange() public returns (uint errorCode);
}

/// @title ERC20-Ether exchange contract.
///
/// @notice Users are able to buy/sell assigned ERC20 token for ether,
/// as long as there is available supply. Contract owner maintains
/// sufficient token and ether supply, and sets buy/sell prices.
///
/// In order to be able to sell tokens, user needs to create allowance
/// for this contract, using standard ERC20 approve() function,
/// so that exchange can take tokens from the user, when user
/// orders a sell.
///
/// Note: all the non constant functions return false instead of
/// throwing in case if state change didn't happen yet.
contract Exchange is Object {
    using SafeMath for uint;
    uint constant ERROR_EXCHANGE_INVALID_INVOCATION = 6000;
    uint constant ERROR_EXCHANGE_MAINTENANCE_MODE = 6001;
    uint constant ERROR_EXCHANGE_INVALID_PRICE = 6002;
    uint constant ERROR_EXCHANGE_INSUFFICIENT_BALANCE = 6004;
    uint constant ERROR_EXCHANGE_INSUFFICIENT_ETHER_SUPPLY = 6005;
    uint constant ERROR_EXCHANGE_PAYMENT_FAILED = 6006;
    uint constant ERROR_EXCHANGE_TRANSFER_FAILED = 6007;

    /// Assigned ERC20 token.
    Asset public asset;
    //Switch for turn on and off the exchange operations
    bool public isActive;
    /// Fee wallet
    address public rewards;
    /// Fee value for operations 10000 is 0.01.
    uint public feePercent;
    /// Authorized price managers
    mapping (address => bool) authorized;
    /// Use external (system provided) price ticker
    bool public usePriceTicker = false;
    /// Price in wei at which exchange buys tokens.
    uint staticBuyPrice;
    /// Price in wei at which exchange sells tokens.
    uint staticSellPrice;

    /// User sold tokens and received wei.
    event ExchangeSell(address indexed exchange, address indexed who, uint token, uint eth);
    /// User bought tokens and payed wei.
    event ExchangeBuy(address indexed exchange, address indexed who, uint token, uint eth);
    /// On received ethers
    event ExchangeReceivedEther(address indexed exchange, address indexed sender, uint256 indexed amount);
    /// On tokens withdraw
    event ExchangeWithdrawTokens(address indexed exchange, address indexed recipient, uint amount, address indexed by);
    /// On eth withdraw
    event ExchangeWithdrawEther(address indexed exchange, address indexed recipient, uint amount, address indexed by);
    /// On Fee updated
    event ExchangeFeeUpdated(address indexed exchange, address rewards, uint feeValue, address indexed by);
    /// On prices updated
    event ExchangePricesUpdated(address indexed exchange, uint buyPrice, uint sellPrice, bool usePriceTicker, address indexed by);
    /// On state changed
    event ExchangeActiveChanged(address indexed exchange, bool isActive, address indexed by);
    /// On error
    event Error(address indexed exchange, uint errorCode);

    /// service registry
    address contractsManager;

    /// @notice only authorized account are permitted to call
    modifier onlyAuthorized() {
        if (msg.sender == contractOwner || authorized[msg.sender]) {
            _;
        }
    }

    /// @notice Assigns ERC20 token for exchange.
    ///
    /// Can be set only once, and only by contract owner.
    ///
    /// @param _asset ERC20 token address.
    ///
    /// @return OK if success.
    function init(
        address _contractsManager,
        address _asset,
        address _rewards,
        uint _fee)
    public
    onlyContractOwner
    returns (uint errorCode)
    {
        require(_contractsManager != 0x0);
        require(_asset != 0x0);
        require(address(asset) == 0x0);

        asset = Asset(_asset);
        contractsManager = _contractsManager;

        if (OK != setFee(_rewards, _fee)) {
            revert();
        }

        return OK;
    }

    /// @notice Authorizes given address to execute restricted methods.
    /// @dev Can be called only by contract owner.
    ///
    /// @return OK if success.
    function grantAuthorized(address _authorized)
    public
    onlyContractOwner
    returns (uint) {
        authorized[_authorized] = true;
        return OK;
    }

    /// @notice Revokes granted access rights.
    /// @dev Can be called only by contract owner.
    ///
    /// @return OK if success.
    function revokeAuthorized(address _authorized)
    public
    onlyContractOwner
    returns (uint) {
        delete authorized[_authorized];
        return OK;
    }

    /// @notice Tells whether given address is authorized or not
    ///
    /// @return `true` if given address is authorized to make secured changes.
    function isAuthorized(address _authorized) public view returns (bool) {
        return authorized[_authorized];
    }

    /// @notice Set exchange operation prices.
    /// Sell price cannot be less than buy price.
    ///
    /// Can be set only by contract owner.
    ///
    /// @param _buyPrice price in wei at which exchange buys tokens
    ///                  or but price coeff if price ticker is enabled
    /// @param _sellPrice price in wei at which exchange sells tokens.
    ///                  or sell price coeff if price ticker is enabled
    /// @param _usePriceTicker force use prices from external price ticker
    ///
    /// @return OK if success.
    function setPrices(uint _buyPrice, uint _sellPrice, bool _usePriceTicker)
    public
    onlyAuthorized
    returns (uint)
    {
        // buy price <= sell price
        require(_buyPrice <= _sellPrice);

        if (staticBuyPrice != _buyPrice ) {
            staticBuyPrice = _buyPrice;
        }

        if (staticSellPrice != _sellPrice) {
            staticSellPrice = _sellPrice;
        }

        if (_usePriceTicker != usePriceTicker) {
            usePriceTicker = _usePriceTicker;
        }

        _emitPricesUpdated(staticBuyPrice, staticSellPrice, usePriceTicker, msg.sender);
        return OK;
    }

    /// @notice Exchange must be activated before using.
    ///
    /// Note: An exchange is not activated `by default` after init().
    /// Make sure that prices are valid before activation.
    ///
    /// @return OK if success.
    function setActive(bool _active)
    public
    onlyContractOwner
    returns (uint)
    {
        isActive = _active;

        _emitActiveChanged(_active, msg.sender);
        return OK;
    }

    /// @notice Returns ERC20 balance of an exchange
    /// @return balance.
    function assetBalance() public view returns (uint) {
        return _balanceOf(this);
    }

    /// @notice Returns the sell price
    /// @return sell price
    function sellPrice() public view returns (uint) {
        if (!usePriceTicker) {
            return staticSellPrice;
        } else {
            return getPriceTickerPrice().mul(staticSellPrice) / 10000;
        }
    }

    /// @notice Returns the buy price
    /// @return buy price
    function buyPrice() public view returns (uint) {
        if (!usePriceTicker) {
            return staticBuyPrice;
        } else {
            return getPriceTickerPrice().mul(staticBuyPrice) / 10000;
        }
    }

    /// @notice Returns price fetched from external price ticker
    function getPriceTickerPrice() public view returns (uint price) {
        PriceProvider priceProvider = PriceProvider(lookupManager("PriceManager"));
        if (!priceProvider.isPriceAvailable(getTokenSymbol(), "ETH")) {
            revert();
        }
        price = priceProvider.price(getTokenSymbol(), "ETH");
        require(price > 0);
    }

    /// @notice Returns symbol of the asset
    /// @return symbol
    function getTokenSymbol() public view returns (bytes32) {
        var (,,symbol,,,,) = ERC20Manager(lookupManager("ERC20Manager"))
                                        .getTokenMetaData(address(asset));
        return symbol;
    }

    /// @notice Returns assigned token address balance.
    ///
    /// @param _address address to get balance.
    ///
    /// @return token balance.
    function _balanceOf(address _address) internal view returns (uint) {
        return asset.balanceOf(_address);
    }

    /// @notice Sell tokens for ether at specified price. Tokens are taken from caller
    /// though an allowance logic.
    /// Amount should be less than or equal to current allowance value.
    /// Price should be less than or equal to current exchange buyPrice.
    ///
    /// @param _amount amount of tokens to sell.
    /// @param _price price in wei at which sell will happen.
    ///
    /// @return OK if success.
    function sell(uint _amount, uint _price) public returns (uint) {
        if (!isActive) {
            return _emitError(ERROR_EXCHANGE_MAINTENANCE_MODE);
        }

        if (_price != buyPrice()) {
            return _emitError(ERROR_EXCHANGE_INVALID_PRICE);
        }

        if (_balanceOf(msg.sender) < _amount) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_BALANCE);
        }

        uint total = _amount.mul(buyPrice()) / (10 ** uint(asset.decimals()));
        if (this.balance < total) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_ETHER_SUPPLY);
        }

        if (!asset.transferFrom(msg.sender, this, _amount)) {
            return _emitError(ERROR_EXCHANGE_PAYMENT_FAILED);
        }

        if (!msg.sender.send(total)) {
            revert();
        }

        _emitSell(msg.sender, _amount, total);
        return OK;
    }

    /// @notice Buy tokens for ether at specified price. Payment needs to be sent along
    /// with the call, and should equal amount * price.
    /// Price should be greater than or equal to current exchange sellPrice.
    ///
    /// @param _amount amount of tokens to buy.
    /// @param _price price in wei at which buy will happen.
    ///
    /// @return OK if success.
    function buy(uint _amount, uint _price) payable public returns (uint) {
        if (!isActive) {
            return _emitError(ERROR_EXCHANGE_MAINTENANCE_MODE);
        }

        if (_price != sellPrice()) {
            return _emitError(ERROR_EXCHANGE_INVALID_PRICE);
        }

        if (_balanceOf(this) < _amount) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_BALANCE);
        }

        uint total = _amount.mul(sellPrice()) / (10 ** uint(asset.decimals()));
        if (msg.value != total) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_ETHER_SUPPLY);
        }

        if (!asset.transfer(msg.sender, _amount)) {
            revert();
        }

        _emitBuy(msg.sender, _amount, total);
        return OK;
    }

    /// @notice Transfer specified amount of tokens from exchange to specified address.
    ///
    /// Can be called only by contract owner.
    ///
    /// @param _recipient address to transfer tokens to.
    /// @param _amount amount of tokens to transfer.
    ///
    /// @return OK if success.
    function withdrawTokens(address _recipient, uint _amount) public onlyContractOwner returns (uint) {
        if (_balanceOf(this) < _amount) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_BALANCE);
        }

        uint amount = (_amount * 10000) / (10000 + feePercent);
        if (!asset.transfer(_recipient, amount)) {
            return _emitError(ERROR_EXCHANGE_TRANSFER_FAILED);
        }

        if (feePercent > 0 && !asset.transfer(rewards, _amount.sub(amount))) {
            revert();
        }

        _emitWithdrawTokens(_recipient, amount, msg.sender);
        return OK;
    }

    /// @notice Transfer all tokens from exchange to specified address.
    ///
    /// Can be called only by contract owner.
    ///
    /// @param _recipient address to transfer tokens to.
    ///
    /// @return OK if success.
    function withdrawAllTokens(address _recipient) public onlyContractOwner returns (uint) {
        return withdrawTokens(_recipient, _balanceOf(this));
    }

    /// @notice Transfer specified amount of wei from exchange to specified address.
    ///
    /// Can be called only by contract owner.
    ///
    /// @param _recipient address to transfer wei to.
    /// @param _amount amount of wei to transfer.
    ///
    /// @return OK if success.
    function withdrawEth(address _recipient, uint _amount) public onlyContractOwner returns (uint) {
        if (this.balance < _amount) {
            return _emitError(ERROR_EXCHANGE_INSUFFICIENT_ETHER_SUPPLY);
        }

        uint amount = (_amount * 10000) / (10000 + feePercent);

        if (!_recipient.send(amount)) {
            return _emitError(ERROR_EXCHANGE_TRANSFER_FAILED);
        }

        if (feePercent > 0 && !rewards.send(_amount.sub(amount))) {
            revert();
        }

        _emitWithdrawEther(_recipient, amount, msg.sender);
        return OK;
    }

    /// @notice Transfer all wei from exchange to specified address.
    ///
    /// Can be called only by contract owner.
    ///
    /// @param _recipient address to transfer wei to.
    ///
    /// @return OK if success.
    function withdrawAllEth(address _recipient) public onlyContractOwner returns (uint) {
        return withdrawEth(_recipient, this.balance);
    }

    /// @notice Transfer all tokens and wei from exchange to specified address.
    ///
    /// Can be called only by contract owner.
    ///
    /// @param _recipient address to transfer tokens and wei to.
    ///
    /// @return OK if success.
    function withdrawAll(address _recipient) public onlyContractOwner returns (uint result) {
        result = withdrawAllTokens(_recipient);
        if (result != OK) {
            return result;
        }

        result = withdrawAllEth(_recipient);
        if (result != OK) {
            return result;
        }

        return OK;
    }

    /// @notice Use kill() instead of destroy() to prevent accidental ether/ERC20 loosing
    function destroy() public onlyContractOwner {
        revert();
    }

    /// @notice Kills an exchnage contract.
    ///
    /// Checks balances of an exchange before destroying.
    /// Destroys an exchange only if balances are empty.
    ///
    /// @return OK if success.
    function kill() public onlyContractOwner returns (uint errorCode) {
        if (this.balance > 0) {
            return _emitError(ERROR_EXCHANGE_INVALID_INVOCATION);
        }

        if (asset.balanceOf(this) > 0) {
            return _emitError(ERROR_EXCHANGE_INVALID_INVOCATION);
        }

        address exchangeManager = lookupManager("ExchangeManager");
        errorCode = IExchangeManager(exchangeManager).removeExchange();
        if (errorCode != OK) {
            return _emitError(errorCode);
        }

        Owned.destroy();
    }

    function setFee(address _rewards, uint _feePercent)
    internal
    returns (uint)
    {
        require(_rewards != 0x0);
        require(/*_feePercent > 1 && */ _feePercent < 10000);

        rewards = _rewards;
        feePercent = _feePercent;

        _emitFeeUpdated(_rewards, _feePercent, msg.sender);
        return OK;
    }

    function getEventsHistory() public view returns (ExchangeEmitter) {
        return contractsManager != 0x0 ? ExchangeEmitter(lookupManager("MultiEventsHistory")) : ExchangeEmitter(this);
    }

    // Returns service by the given `type`
    function lookupManager(bytes32 _identifier) internal view returns (address manager) {
        manager = ContractsManager(contractsManager).getContractAddressByType(_identifier);
        require(manager != 0x0);
    }

    /* Events helpers */

    function _emitError(uint _errorCode) internal returns (uint) {
        getEventsHistory().emitError(_errorCode);
        return _errorCode;
    }

    function _emitFeeUpdated(address _rewards, uint _feePercent, address _by) internal {
        getEventsHistory().emitFeeUpdated(_rewards, _feePercent, _by);
    }

    function _emitPricesUpdated(uint _buyPrice, uint _sellPrice, bool _usePriceTicker, address _by) internal {
        getEventsHistory().emitPricesUpdated(_buyPrice, _sellPrice, _usePriceTicker, _by);
    }

    function _emitActiveChanged(bool _isActive, address _by) internal {
        getEventsHistory().emitActiveChanged(_isActive, _by);
    }

    function _emitBuy(address _who, uint _token, uint _eth) internal {
        getEventsHistory().emitBuy(_who, _token, _eth);
    }

    function _emitSell(address _who, uint _token, uint _eth) internal {
        getEventsHistory().emitSell(_who, _token, _eth);
    }

    function _emitWithdrawEther(address _recipient, uint _amount, address _by) internal {
        getEventsHistory().emitWithdrawEther(_recipient, _amount, _by);
    }

    function _emitWithdrawTokens(address _recipient, uint _amount, address _by) internal {
        getEventsHistory().emitWithdrawTokens(_recipient, _amount, _by);
    }

    function _emitReceivedEther(address _sender, uint _amount) internal {
        getEventsHistory().emitReceivedEther(_sender, _amount);
    }

    /* emit* methods are designed to be called only via EventsHistory */

    function emitError(uint _errorCode) public {
        Error(msg.sender, _errorCode);
    }

    function emitFeeUpdated(address _rewards, uint _feePercent, address _by) public {
        ExchangeFeeUpdated(msg.sender, _rewards, _feePercent, _by);
    }

    function emitPricesUpdated(uint _buyPrice, uint _sellPrice, bool _usePriceTicker, address _by) public {
        ExchangePricesUpdated(msg.sender, _buyPrice, _sellPrice, _usePriceTicker, _by);
    }

    function emitActiveChanged(bool _isActive, address _by) public {
        ExchangeActiveChanged(msg.sender, _isActive, _by);
    }

    function emitBuy(address _who, uint _token, uint _eth) public {
        ExchangeBuy(msg.sender, _who, _token, _eth);
    }

    function emitSell(address _who, uint _token, uint _eth) public {
        ExchangeSell(msg.sender, _who, _token, _eth);
    }

    function emitWithdrawEther(address _recipient, uint _amount, address _by) public {
        ExchangeWithdrawEther(msg.sender, _recipient, _amount, _by);
    }

    function emitWithdrawTokens(address _recipient, uint _amount, address _by) public {
        ExchangeWithdrawTokens(msg.sender, _recipient, _amount, _by);
    }

    function emitReceivedEther(address _sender, uint _amount) public {
        ExchangeReceivedEther(msg.sender, _sender, _amount);
    }

    /// @notice Accept all ether to maintain exchange supply.
    function() payable public {
        if (msg.value != 0) {
            _emitReceivedEther(msg.sender, msg.value);
        } else {
            revert();
        }
    }
}
