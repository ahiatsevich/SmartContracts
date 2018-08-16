/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;

import {Storage as StorageFoundation} from "../storage/Storage.sol";
import "../storage/StorageAdapter.sol";
import "./ChronoBankPlatformEmitter.sol";
import "./ChronoBankPlatformRouter.sol";
import "../lib/SafeMath.sol";


contract ProxyEventsEmitter {
    function emitTransfer(address _from, address _to, uint _value) public;
    function emitApprove(address _from, address _spender, uint _value) public;
}


///  @title ChronoBank Platform.
///
///  The official ChronoBank assets platform powering TIME and LHT tokens, and possibly
///  other unknown tokens needed later.
///  Platform uses MultiEventsHistory contract to keep events, so that in case it needs to be redeployed
///  at some point, all the events keep appearing at the same place.
///
///  Every asset is meant to be used through a proxy contract. Only one proxy contract have access
///  rights for a particular asset.
///
///  Features: transfers, allowances, supply adjustments, lost wallet access recovery.
///
///  Note: all the non constant functions return false instead of throwing in case if state change
/// didn't happen yet.
contract ChronoBankPlatform is 
    StorageFoundation, 
    StorageAdapter, 
    ChronoBankPlatformRouterCore,
    ChronoBankPlatformCore, 
    ChronoBankPlatformEmitter 
{
    uint constant OK = 1;

    using SafeMath for uint;

    uint constant CHRONOBANK_PLATFORM_SCOPE = 15000;
    uint constant CHRONOBANK_PLATFORM_PROXY_ALREADY_EXISTS = CHRONOBANK_PLATFORM_SCOPE + 0;
    uint constant CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF = CHRONOBANK_PLATFORM_SCOPE + 1;
    uint constant CHRONOBANK_PLATFORM_INVALID_VALUE = CHRONOBANK_PLATFORM_SCOPE + 2;
    uint constant CHRONOBANK_PLATFORM_INSUFFICIENT_BALANCE = CHRONOBANK_PLATFORM_SCOPE + 3;
    uint constant CHRONOBANK_PLATFORM_NOT_ENOUGH_ALLOWANCE = CHRONOBANK_PLATFORM_SCOPE + 4;
    uint constant CHRONOBANK_PLATFORM_ASSET_ALREADY_ISSUED = CHRONOBANK_PLATFORM_SCOPE + 5;
    uint constant CHRONOBANK_PLATFORM_CANNOT_ISSUE_FIXED_ASSET_WITH_INVALID_VALUE = CHRONOBANK_PLATFORM_SCOPE + 6;
    uint constant CHRONOBANK_PLATFORM_CANNOT_REISSUE_FIXED_ASSET = CHRONOBANK_PLATFORM_SCOPE + 7;
    uint constant CHRONOBANK_PLATFORM_SUPPLY_OVERFLOW = CHRONOBANK_PLATFORM_SCOPE + 8;
    uint constant CHRONOBANK_PLATFORM_NOT_ENOUGH_TOKENS = CHRONOBANK_PLATFORM_SCOPE + 9;
    uint constant CHRONOBANK_PLATFORM_INVALID_NEW_OWNER = CHRONOBANK_PLATFORM_SCOPE + 10;
    uint constant CHRONOBANK_PLATFORM_ALREADY_TRUSTED = CHRONOBANK_PLATFORM_SCOPE + 11;
    uint constant CHRONOBANK_PLATFORM_SHOULD_RECOVER_TO_NEW_ADDRESS = CHRONOBANK_PLATFORM_SCOPE + 12;
    uint constant CHRONOBANK_PLATFORM_ASSET_IS_NOT_ISSUED = CHRONOBANK_PLATFORM_SCOPE + 13;
    uint constant CHRONOBANK_PLATFORM_INVALID_INVOCATION = CHRONOBANK_PLATFORM_SCOPE + 17;

    /// @dev Should use interface of the emitter, but address of events history.
    address public eventsHistory;

    /// @dev Emits Error event with specified error message.
    /// Should only be used if no state changes happened.
    /// @param _errorCode code of an error
    function _error(uint _errorCode) internal returns (uint) {
        ChronoBankPlatformEmitter(eventsHistory).emitError(_errorCode);
        return _errorCode;
    }

    /// @dev Emits Error if called not by asset owner.
    modifier onlyOwner(bytes32 _symbol) {
        if (isOwner(msg.sender, _symbol)) {
            _;
        }
    }

    /// @dev UNAUTHORIZED if called not by one of symbol's partowners or owner
    modifier onlyOneOfOwners(bytes32 _symbol) {
        if (hasAssetRights(msg.sender, _symbol)) {
            _;
        }
    }

    /// @dev UNAUTHORIZED if called not by one of partowners or contract's owner
    modifier onlyOneOfContractOwners() {
        if (contractOwner == msg.sender || partowners(msg.sender)) {
            _;
        }
    }

    /// @dev Emits Error if called not by asset proxy.
    modifier onlyProxy(bytes32 _symbol) {
        if (proxies(_symbol) == msg.sender) {
            _;
        }
    }

    /// @dev Emits Error if _from doesn't trust _to.
    modifier checkTrust(address _from, address _to) {
        if (isTrusted(_from, _to)) {
            _;
        }
    }

    constructor() StorageAdapter(this, CHRONOBANK_PLATFORM_CRATE) public {
        partownersStorage.init("partowners");
        proxiesStorage.init("proxies");
        symbolsStorage.init("symbols");

        holdersCountStorage.init("holdersCount");
        holderIndexStorage.init("holderIndex");
        holdersAddressStorage.init("holdersAddress");
        holdersTrustStorage.init("holdersTrust");
        
        assetOwner.init("assetOwner");
        assetTotalSupply.init("assetTotalSupply");
        assetName.init("assetName");
        assetDescription.init("assetDescription");
        assetIsReissuable.init("assetIsReissuable");
        assetBaseUnit.init("assetBaseUnit");
        assetPartowners.init("assetPartowners");
        assetWalletBalance.init("assetWalletBalance");
        assetWalletAllowance.init("assetWalletAllowance");
    }

    /// @dev Asset symbol to asset details.
    /// @return {
    ///     "_description": "will be null, since cannot store and return dynamic-sized types in storage (fixed in v0.4.24),
    /// }
    function assets(bytes32 _symbol) public view returns (
        uint _owner,
        uint _totalSupply,
        string _name,
        string _description,
        bool _isReissuable,
        uint8 _baseUnit
    ) {
        _owner = store.get(assetOwner, _symbol);
        _totalSupply = store.get(assetTotalSupply, _symbol);
        _name = store.get(assetName, _symbol);
        _description = store.get(assetDescription, _symbol);
        _isReissuable = store.get(assetIsReissuable, _symbol);
        _baseUnit = store.get(assetBaseUnit, _symbol);
    }

    function holdersCount() public view returns (uint) {
        return store.get(holdersCountStorage);
    }

    function holders(uint _holderId) public view returns (address) {
        return store.get(holdersAddressStorage, _holderId);
    }

    function symbols(uint _idx) public view returns (bytes32) {
        return store.get(symbolsStorage, _idx);
    }

    /// @notice Provides a cheap way to get number of symbols registered in a platform
    /// @return number of symbols
    function symbolsCount() public view returns (uint) {
        return store.count(symbolsStorage);
    }

    function proxies(bytes32 _symbol) public view returns (address) {
        return store.get(proxiesStorage, _symbol);
    }

    function partowners(address _address) public view returns (bool) {
        return store.get(partownersStorage, _address);
    }

    /// @notice Adds a co-owner of a contract. Might be more than one co-owner
    /// @dev Allowed to only contract onwer
    /// @param _partowner a co-owner of a contract
    /// @return result code of an operation
    function addPartOwner(address _partowner) onlyContractOwner public returns (uint) {
        store.set(partownersStorage, _partowner, true);
        return OK;
    }

    /// @notice Removes a co-owner of a contract
    /// @dev Should be performed only by root contract owner
    /// @param _partowner a co-owner of a contract
    /// @return result code of an operation
    function removePartOwner(address _partowner) onlyContractOwner public returns (uint) {
        store.set(partownersStorage, _partowner, false);
        return OK;
    }

    /// @notice Sets EventsHistory contract address.
    /// @dev Can be set only by owner.
    /// @param _eventsHistory MultiEventsHistory contract address.
    /// @return success.
    function setupEventsHistory(address _eventsHistory) onlyContractOwner public returns (uint errorCode) {
        eventsHistory = _eventsHistory;
        return OK;
    }

    /// @notice Check asset existance.
    /// @param _symbol asset symbol.
    /// @return asset existance.
    function isCreated(bytes32 _symbol) public view returns (bool) {
        return store.get(assetOwner, _symbol) != 0x0;
    }

    /// @notice Returns asset decimals.
    /// @param _symbol asset symbol.
    /// @return asset decimals.
    function baseUnit(bytes32 _symbol) public view returns (uint8) {
        return store.get(assetBaseUnit, _symbol);
    }

    /// @notice Returns asset name.
    /// @param _symbol asset symbol.
    /// @return asset name.
    function name(bytes32 _symbol) public view returns (string) {
        return store.get(assetName, _symbol);
    }

    /// @notice Returns asset description.
    /// @param _symbol asset symbol.
    /// @return asset description.
    function description(bytes32 _symbol) public view returns (string) {
        return store.get(assetDescription, _symbol);
    }

    /// @notice Returns asset reissuability.
    /// @param _symbol asset symbol.
    /// @return asset reissuability.
    function isReissuable(bytes32 _symbol) public view returns (bool) {
        return store.get(assetIsReissuable, _symbol);
    }

    /// @notice Returns asset owner address.
    /// @param _symbol asset symbol.
    /// @return asset owner address.
    function owner(bytes32 _symbol) public view returns (address) {
        return store.get(holdersAddressStorage, store.get(assetOwner, _symbol));
    }

    /// @notice Check if specified address has asset owner rights.
    /// @param _owner address to check.
    /// @param _symbol asset symbol.
    /// @return owner rights availability.
    function isOwner(address _owner, bytes32 _symbol) public view returns (bool) {
        return isCreated(_symbol) && (_assetOwner(_symbol) == getHolderId(_owner));
    }

    /// @notice Checks if a specified address has asset owner or co-owner rights.
    /// @param _owner address to check.
    /// @param _symbol asset symbol.
    /// @return owner rights availability.
    function hasAssetRights(address _owner, bytes32 _symbol) public view returns (bool) {
        uint holderId = getHolderId(_owner);
        return isCreated(_symbol) && (_assetOwner(_symbol) == holderId || store.get(assetPartowners, _symbol, holderId));
    }

    /// @notice Returns asset total supply.
    /// @param _symbol asset symbol.
    /// @return asset total supply.
    function totalSupply(bytes32 _symbol) public view returns (uint) {
        return store.get(assetTotalSupply, _symbol);
    }

    /// @notice Returns asset balance for a particular holder.
    /// @param _holder holder address.
    /// @param _symbol asset symbol.
    /// @return holder balance.
    function balanceOf(address _holder, bytes32 _symbol) public view returns (uint) {
        return _balanceOf(getHolderId(_holder), _symbol);
    }

    /// @notice Returns asset balance for a particular holder id.
    /// @param _holderId holder id.
    /// @param _symbol asset symbol.
    /// @return holder balance.
    function _balanceOf(uint _holderId, bytes32 _symbol) public view returns (uint) {
        return store.get(assetWalletBalance, _symbol, _holderId);
    }

    /// @notice Returns current address for a particular holder id.
    /// @param _holderId holder id.
    /// @return holder address.
    function _address(uint _holderId) public view returns (address) {
        return store.get(holdersAddressStorage, _holderId);
    }

    /// @notice Adds a co-owner for an asset with provided symbol.
    /// @dev Should be performed by a contract owner or its co-owners
    /// @param _symbol asset's symbol
    /// @param _partowner a co-owner of an asset
    /// @return errorCode result code of an operation
    function addAssetPartOwner(bytes32 _symbol, address _partowner) onlyOneOfOwners(_symbol) public returns (uint) {
        uint holderId = _createHolderId(_partowner);
        store.set(assetPartowners, _symbol, holderId, true);
        ChronoBankPlatformEmitter(eventsHistory).emitOwnershipChange(0x0, _partowner, _symbol);
        return OK;
    }

    /// @notice Removes a co-owner for an asset with provided symbol.
    /// @dev Should be performed by a contract owner or its co-owners
    /// @param _symbol asset's symbol
    /// @param _partowner a co-owner of an asset
    /// @return errorCode result code of an operation
    function removeAssetPartOwner(bytes32 _symbol, address _partowner) onlyOneOfOwners(_symbol) public returns (uint) {
        uint holderId = getHolderId(_partowner);
        store.set(assetPartowners, _symbol, holderId, false);
        ChronoBankPlatformEmitter(eventsHistory).emitOwnershipChange(_partowner, 0x0, _symbol);
        return OK;
    }

    /// @notice Sets Proxy contract address for a particular asset.
    /// @dev Can be set only once for each asset and only by contract owner.
    /// @param _proxyAddress Proxy contract address.
    /// @param _symbol asset symbol.
    /// @return success.
    function setProxy(address _proxyAddress, bytes32 _symbol) onlyOneOfContractOwners public returns (uint) {
        if (proxies(_symbol) != 0x0) {
            return CHRONOBANK_PLATFORM_PROXY_ALREADY_EXISTS;
        }

        store.set(proxiesStorage, _symbol, _proxyAddress);
        return OK;
    }
    
    /// @notice Performes asset transfer for multiple destinations
    /// @param addresses list of addresses to receive some amount
    /// @param values list of asset amounts for according addresses
    /// @param _symbol asset symbol
    /// @return {
    ///     "errorCode": "resultCode of an operation",
    ///     "count": "an amount of succeeded transfers"
    /// }
    function massTransfer(address[] addresses, uint[] values, bytes32 _symbol)
    onlyOneOfOwners(_symbol)
    external
    returns (uint errorCode, uint count)
    {
        require(addresses.length == values.length, "Different length of addresses and values for mass transfer");
        require(_symbol != 0x0, "Asset's symbol cannot be 0");

        uint senderId = _createHolderId(msg.sender);

        uint success = 0;
        for(uint idx = 0; idx < addresses.length && gasleft() > 110000; idx++) {
            uint value = values[idx];

            if (value == 0) {
                _error(CHRONOBANK_PLATFORM_INVALID_VALUE);
                continue;
            }

            if (_balanceOf(senderId, _symbol) < value) {
                _error(CHRONOBANK_PLATFORM_INSUFFICIENT_BALANCE);
                continue;
            }

            if (msg.sender == addresses[idx]) {
                _error(CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF);
                continue;
            }

            uint holderId = _createHolderId(addresses[idx]);

            _transferDirect(senderId, holderId, value, _symbol);
            ChronoBankPlatformEmitter(eventsHistory).emitTransfer(msg.sender, addresses[idx], _symbol, value, "");

            success++;
        }

        return (OK, success);
    }

    /// @dev Transfers asset balance between holders wallets.
    /// @param _fromId holder id to take from.
    /// @param _toId holder id to give to.
    /// @param _value amount to transfer.
    /// @param _symbol asset symbol.
    function _transferDirect(
        uint _fromId, 
        uint _toId, 
        uint _value, 
        bytes32 _symbol
    ) 
    internal 
    {
        store.set(assetWalletBalance, _symbol, _fromId, store.get(assetWalletBalance, _symbol, _fromId).sub(_value));
        store.set(assetWalletBalance, _symbol, _toId, store.get(assetWalletBalance, _symbol, _toId).add(_value));
    }

    /// @dev Transfers asset balance between holders wallets.
    /// Performs sanity checks and takes care of allowances adjustment.
    ///
    /// @param _fromId holder id to take from.
    /// @param _toId holder id to give to.
    /// @param _value amount to transfer.
    /// @param _symbol asset symbol.
    /// @param _reference transfer comment to be included in a Transfer event.
    /// @param _senderId transfer initiator holder id.
    ///
    /// @return success.
    function _transfer(
        uint _fromId, 
        uint _toId, 
        uint _value, 
        bytes32 _symbol, 
        string _reference, 
        uint _senderId
    ) 
    internal 
    returns (uint) 
    {
        // Should not allow to send to oneself.
        if (_fromId == _toId) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF);
        }
        // Should have positive value.
        if (_value == 0) {
            return _error(CHRONOBANK_PLATFORM_INVALID_VALUE);
        }
        // Should have enough balance.
        if (_balanceOf(_fromId, _symbol) < _value) {
            return _error(CHRONOBANK_PLATFORM_INSUFFICIENT_BALANCE);
        }
        // Should have enough allowance.
        if (_fromId != _senderId && _allowance(_fromId, _senderId, _symbol) < _value) {
            return _error(CHRONOBANK_PLATFORM_NOT_ENOUGH_ALLOWANCE);
        }

        _transferDirect(_fromId, _toId, _value, _symbol);
        // Adjust allowance.
        _decrementWalletAllowance(_fromId, _senderId, _value, _symbol);
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: n/a after HF 4;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitTransfer(_address(_fromId), _address(_toId), _symbol, _value, _reference);
        _proxyTransferEvent(_fromId, _toId, _value, _symbol);
        return OK;
    }

    function _decrementWalletAllowance(
        uint _fromId,
        uint _senderId,
        uint _value,
        bytes32 _symbol
    )
    private 
    {
        if (_fromId != _senderId) {
            store.set(assetWalletAllowance, _symbol, _fromId, _senderId, store.get(assetWalletAllowance, _symbol, _fromId, _senderId).sub(_value));
        }
    }

    /// @dev Transfers asset balance between holders wallets.
    /// Can only be called by asset proxy.
    ///
    /// @param _to holder address to give to.
    /// @param _value amount to transfer.
    /// @param _symbol asset symbol.
    /// @param _reference transfer comment to be included in a Transfer event.
    /// @param _sender transfer initiator address.
    ///
    /// @return success.
    function proxyTransferWithReference(
        address _to, 
        uint _value, 
        bytes32 _symbol, 
        string _reference, 
        address _sender
    ) 
    onlyProxy(_symbol) 
    public 
    returns (uint) 
    {
        return _transfer(getHolderId(_sender), _createHolderId(_to), _value, _symbol, _reference, getHolderId(_sender));
    }

    /// @dev Ask asset Proxy contract to emit ERC20 compliant Transfer event.
    /// @param _fromId holder id to take from.
    /// @param _toId holder id to give to.
    /// @param _value amount to transfer.
    /// @param _symbol asset symbol.
    function _proxyTransferEvent(uint _fromId, uint _toId, uint _value, bytes32 _symbol) internal {
        address _proxy = proxies(_symbol);
        if (_proxy != 0x0) {
            // Internal Out Of Gas/Throw: revert this transaction too;
            // Call Stack Depth Limit reached: n/a after HF 4;
            // Recursive Call: safe, all changes already made.
            ProxyEventsEmitter(_proxy).emitTransfer(_address(_fromId), _address(_toId), _value);
        }
    }

    /// @notice Returns holder id for the specified address.
    /// @param _holder holder address.
    /// @return holder id.
    function getHolderId(address _holder) public view returns (uint) {
        return store.get(holderIndexStorage, _holder);
    }

    /// @dev Returns holder id for the specified address, creates it if needed.
    /// @param _holder holder address.
    /// @return holder id.
    function _createHolderId(address _holder) internal returns (uint) {
        uint _holderId = getHolderId(_holder);
        if (_holderId == 0) {
            _holderId = store.get(holdersCountStorage) + 1;
            store.set(holderIndexStorage, _holder, _holderId);
            store.set(holdersAddressStorage, _holderId, _holder);
            store.set(holdersCountStorage, _holderId);
        }

        return _holderId;
    }

    function _assetOwner(bytes32 _symbol) internal returns (uint) {
        return store.get(assetOwner, _symbol);
    }

    function stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        assembly {
            result := mload(add(source, 32))
        }
    }

    /// @notice Issues new asset token on the platform.
    ///
    /// Tokens issued with this call go straight to contract owner.
    /// Each symbol can be issued only once, and only by contract owner.
    ///
    /// @param _symbol asset symbol.
    /// @param _value amount of tokens to issue immediately.
    /// @param _name name of the asset.
    /// @param _description description for the asset.
    /// @param _baseUnit number of decimals.
    /// @param _isReissuable dynamic or fixed supply.
    ///
    /// @return success.
    function issueAsset(
        bytes32 _symbol, 
        uint _value, 
        string _name, 
        string _description, 
        uint8 _baseUnit, 
        bool _isReissuable
    ) 
    public 
    returns (uint) 
    {
        return issueAsset(_symbol, _value, _name, _description, _baseUnit, _isReissuable, msg.sender);
    }

    /// @notice Issues new asset token on the platform.
    ///
    /// Tokens issued with this call go straight to contract owner.
    /// Each symbol can be issued only once, and only by contract owner.
    ///
    /// @param _symbol asset symbol.
    /// @param _value amount of tokens to issue immediately.
    /// @param _name name of the asset.
    /// @param _description description for the asset.
    /// @param _baseUnit number of decimals.
    /// @param _isReissuable dynamic or fixed supply.
    /// @param _account address where issued balance will be held
    ///
    /// @return success.
    function issueAsset(
        bytes32 _symbol, 
        uint _value, 
        string _name, 
        string _description, 
        uint8 _baseUnit, 
        bool _isReissuable, 
        address _account
    ) 
    onlyOneOfContractOwners 
    public 
    returns (uint) 
    {
        // Should have positive value if supply is going to be fixed.
        if (_value == 0 && !_isReissuable) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_ISSUE_FIXED_ASSET_WITH_INVALID_VALUE);
        }
        // Should not be issued yet.
        if (isCreated(_symbol)) {
            return _error(CHRONOBANK_PLATFORM_ASSET_ALREADY_ISSUED);
        }
        uint holderId = _createHolderId(_account);
        uint creatorId = _account == msg.sender ? holderId : _createHolderId(msg.sender);
        store.add(symbolsStorage, _symbol);
        store.set(assetOwner, _symbol, creatorId);
        store.set(assetTotalSupply, _symbol, _value);
        store.set(assetName, _symbol, _name);
        store.set(assetDescription, _symbol, _description);
        store.set(assetIsReissuable, _symbol, _isReissuable);
        store.set(assetBaseUnit, _symbol, _baseUnit);
        store.set(assetWalletBalance, _symbol, holderId, _value);
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: n/a after HF 4;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitIssue(_symbol, _value, _address(holderId));
        return OK;
    }

    /// @notice Issues additional asset tokens if the asset have dynamic supply.
    ///
    /// Tokens issued with this call go straight to asset owner.
    /// Can only be called by asset owner.
    ///
    /// @param _symbol asset symbol.
    /// @param _value amount of additional tokens to issue.
    ///
    /// @return success.
    function reissueAsset(bytes32 _symbol, uint _value) onlyOneOfOwners(_symbol) public returns (uint) {
        // Should have positive value.
        if (_value == 0) {
            return _error(CHRONOBANK_PLATFORM_INVALID_VALUE);
        }

        // Should have dynamic supply.
        if (!store.get(assetIsReissuable, _symbol)) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_REISSUE_FIXED_ASSET);
        }

        uint _totalSupply = store.get(assetTotalSupply, _symbol);
        // Resulting total supply should not overflow.
        if (_totalSupply + _value < _totalSupply) {
            return _error(CHRONOBANK_PLATFORM_SUPPLY_OVERFLOW);
        }
        uint holderId = getHolderId(msg.sender);
        store.set(assetWalletBalance, _symbol, holderId, store.get(assetWalletBalance, _symbol, holderId).add(_value));
        store.set(assetTotalSupply, _symbol, _totalSupply.add(_value));
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: n/a after HF 4;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitIssue(_symbol, _value, _address(holderId));
        _proxyTransferEvent(0, holderId, _value, _symbol);
        return OK;
    }

    /// @notice Destroys specified amount of senders asset tokens.
    ///
    /// @param _symbol asset symbol.
    /// @param _value amount of tokens to destroy.
    ///
    /// @return success.
    function revokeAsset(bytes32 _symbol, uint _value) public returns (uint) {
        // Should have positive value.
        if (_value == 0) {
            return _error(CHRONOBANK_PLATFORM_INVALID_VALUE);
        }

        uint holderId = getHolderId(msg.sender);
        // Should have enough tokens.
        uint _holderBalance = store.get(assetWalletBalance, _symbol, holderId);
        if (_holderBalance < _value) {
            return _error(CHRONOBANK_PLATFORM_NOT_ENOUGH_TOKENS);
        }
        store.set(assetWalletBalance, _symbol, holderId, _holderBalance.sub(_value));
        store.set(assetTotalSupply, _symbol, store.get(assetTotalSupply, _symbol).sub(_value));
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: n/a after HF 4;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitRevoke(_symbol, _value, _address(holderId));
        _proxyTransferEvent(holderId, 0, _value, _symbol);
        return OK;
    }

    /// @notice Passes asset ownership to specified address.
    ///
    /// Only ownership is changed, balances are not touched.
    /// Can only be called by asset owner.
    ///
    /// @param _symbol asset symbol.
    /// @param _newOwner address to become a new owner.
    ///
    /// @return success.
    function changeOwnership(bytes32 _symbol, address _newOwner) onlyOwner(_symbol) public returns (uint) {
        if (_newOwner == 0x0) {
            return _error(CHRONOBANK_PLATFORM_INVALID_NEW_OWNER);
        }

        uint newOwnerId = _createHolderId(_newOwner);
        uint _assetOwner = store.get(assetOwner, _symbol);
        // Should pass ownership to another holder.
        if (_assetOwner == newOwnerId) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF);
        }
        address oldOwner = _address(_assetOwner);
        store.set(assetOwner, _symbol, newOwnerId);
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: n/a after HF 4;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitOwnershipChange(oldOwner, _newOwner, _symbol);
        return OK;
    }

    /// @notice Check if specified holder trusts an address with recovery procedure.
    /// @param _from truster.
    /// @param _to trustee.
    /// @return trust existance.
    function isTrusted(address _from, address _to) public view returns (bool) {
        return store.get(holdersTrustStorage, getHolderId(_from), _to);
    }

    /// @notice Trust an address to perform recovery procedure for the caller.
    /// @param _to trustee.
    /// @return success.
    function trust(address _to) public returns (uint) {
        uint fromId = _createHolderId(msg.sender);
        // Should trust to another address.
        if (fromId == getHolderId(_to)) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF);
        }
        // Should trust to yet untrusted.
        if (isTrusted(msg.sender, _to)) {
            return _error(CHRONOBANK_PLATFORM_ALREADY_TRUSTED);
        }

        store.set(holdersTrustStorage, fromId, _to, true);
        return OK;
    }

    /// @notice Revoke trust to perform recovery procedure from an address.
    /// @param _to trustee.
    /// @return success.
    function distrust(address _to) checkTrust(msg.sender, _to) public returns (uint) {
        store.set(holdersTrustStorage, getHolderId(msg.sender), _to, false);
        return OK;
    }

    /// @notice Perform recovery procedure.
    ///
    /// This function logic is actually more of an addAccess(uint _holderId, address _to).
    /// It grants another address access to recovery subject wallets.
    /// Can only be called by trustee of recovery subject.
    ///
    /// @param _from holder address to recover from.
    /// @param _to address to grant access to.
    ///
    /// @return success.
    function recover(address _from, address _to) checkTrust(_from, msg.sender) public returns (uint errorCode) {
        // Should recover to previously unused address.
        if (getHolderId(_to) != 0) {
            return _error(CHRONOBANK_PLATFORM_SHOULD_RECOVER_TO_NEW_ADDRESS);
        }
        // We take current holder address because it might not equal _from.
        // It is possible to recover from any old holder address, but event should have the current one.
        uint _fromHolderId = store.get(holderIndexStorage, _from);
        address _fromRef = store.get(holdersAddressStorage, _fromHolderId);
        store.set(holdersAddressStorage, _fromHolderId, _to);
        store.set(holderIndexStorage, _to, _fromHolderId);
        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitRecovery(_fromRef, _to, msg.sender);
        return OK;
    }

    /// @dev Sets asset spending allowance for a specified spender.
    ///
    /// Note: to revoke allowance, one needs to set allowance to 0.
    ///
    /// @param _spenderId holder id to set allowance for.
    /// @param _value amount to allow.
    /// @param _symbol asset symbol.
    /// @param _senderId approve initiator holder id.
    ///
    /// @return success.
    function _approve(
        uint _spenderId, 
        uint _value, 
        bytes32 _symbol, 
        uint _senderId
    ) 
    internal 
    returns (uint) 
    {
        // Asset should exist.
        if (!isCreated(_symbol)) {
            return _error(CHRONOBANK_PLATFORM_ASSET_IS_NOT_ISSUED);
        }
        // Should allow to another holder.
        if (_senderId == _spenderId) {
            return _error(CHRONOBANK_PLATFORM_CANNOT_APPLY_TO_ONESELF);
        }

        // Double Spend Attack checkpoint
        if (store.get(assetWalletAllowance, _symbol, _senderId, _spenderId) != 0 && _value != 0) {
            return _error(CHRONOBANK_PLATFORM_INVALID_INVOCATION);
        }

        store.set(assetWalletAllowance, _symbol, _senderId, _spenderId, _value);

        // Internal Out Of Gas/Throw: revert this transaction too;
        // Call Stack Depth Limit reached: revert this transaction too;
        // Recursive Call: safe, all changes already made.
        ChronoBankPlatformEmitter(eventsHistory).emitApprove(_address(_senderId), _address(_spenderId), _symbol, _value);
        address _proxy = proxies(_symbol);
        if (_proxy != 0x0) {
            // Internal Out Of Gas/Throw: revert this transaction too;
            // Call Stack Depth Limit reached: n/a after HF 4;
            // Recursive Call: safe, all changes already made.
            ProxyEventsEmitter(_proxy).emitApprove(_address(_senderId), _address(_spenderId), _value);
        }
        return OK;
    }

    /// @dev Sets asset spending allowance for a specified spender.
    ///
    /// Can only be called by asset proxy.
    ///
    /// @param _spender holder address to set allowance to.
    /// @param _value amount to allow.
    /// @param _symbol asset symbol.
    /// @param _sender approve initiator address.
    ///
    /// @return success.
    function proxyApprove(
        address _spender, 
        uint _value, 
        bytes32 _symbol, 
        address _sender
    ) 
    onlyProxy(_symbol) 
    public 
    returns (uint) 
    {
        return _approve(_createHolderId(_spender), _value, _symbol, _createHolderId(_sender));
    }

    /// @notice Performs allowance transfer of asset balance between holders wallets.
    ///
    /// @dev Can only be called by asset proxy.
    ///
    /// @param _from holder address to take from.
    /// @param _to holder address to give to.
    /// @param _value amount to transfer.
    /// @param _symbol asset symbol.
    /// @param _reference transfer comment to be included in a Transfer event.
    /// @param _sender allowance transfer initiator address.
    ///
    /// @return success.
    function proxyTransferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        bytes32 _symbol, 
        string _reference, 
        address _sender
    ) 
    onlyProxy(_symbol) 
    public 
    returns (uint) 
    {
        return _transfer(getHolderId(_from), _createHolderId(_to), _value, _symbol, _reference, getHolderId(_sender));
    }

    /// @dev Returns asset allowance from one holder to another.
    /// @param _from holder that allowed spending.
    /// @param _spender holder that is allowed to spend.
    /// @param _symbol asset symbol.
    /// @return holder to spender allowance.
    function allowance(address _from, address _spender, bytes32 _symbol) public view returns (uint) {
        return _allowance(getHolderId(_from), getHolderId(_spender), _symbol);
    }

    /// @dev Returns asset allowance from one holder to another.
    /// @param _fromId holder id that allowed spending.
    /// @param _toId holder id that is allowed to spend.
    /// @param _symbol asset symbol.
    /// @return holder to spender allowance.
    function _allowance(uint _fromId, uint _toId, bytes32 _symbol) internal view returns (uint) {
        return store.get(assetWalletAllowance, _symbol, _fromId, _toId);
    }
}
