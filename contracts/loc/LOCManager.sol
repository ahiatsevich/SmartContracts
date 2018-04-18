/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../core/common/BaseManager.sol";
import "../assets/FeeInterface.sol";
import "../core/erc20/ERC20ManagerInterface.sol";
import "../core/platform/ChronoBankAssetProxyInterface.sol";
import "./LOCManagerEmitter.sol";
import "./ReissuableWalletInterface.sol";


contract LOCManager is LOCManagerEmitter, BaseManager {

    uint constant ERROR_LOC_NOT_FOUND = 1000;
    uint constant ERROR_LOC_EXISTS = 1001;
    uint constant ERROR_LOC_INACTIVE = 1002;
    uint constant ERROR_LOC_SHOULD_NO_BE_ACTIVE = 1003;
    uint constant ERROR_LOC_INVALID_PARAMETER = 1004;
    uint constant ERROR_LOC_INVALID_INVOCATION = 1005;
    uint constant ERROR_LOC_SEND_ASSET = 1007;
    uint constant ERROR_LOC_REQUESTED_ISSUE_VALUE_EXCEEDED = 1008;
    uint constant ERROR_LOC_REISSUING_ASSET_FAILED = 1009;
    uint constant ERROR_LOC_REQUESTED_REVOKE_VALUE_EXCEEDED = 1010;
    uint constant ERROR_LOC_REVOKING_ASSET_FAILED = 1011;

    StorageInterface.Set offeringCompaniesNames;
    StorageInterface.Bytes32Bytes32Mapping website;
    StorageInterface.Bytes32Bytes32Mapping publishedHash;
    StorageInterface.Bytes32Bytes32Mapping currency;
    StorageInterface.Bytes32UIntMapping issued;
    StorageInterface.Bytes32UIntMapping issueLimit;
    StorageInterface.Bytes32UIntMapping expDate;
    StorageInterface.Bytes32UIntMapping status;
    StorageInterface.Bytes32UIntMapping createDate;
    StorageInterface.Address walletStorage;

    enum Status { maintenance, active, suspended, bankrupt }

    function LOCManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        offeringCompaniesNames.init("offeringCompaniesNames");
        website.init("website");
        publishedHash.init("publishedHash");
        currency.init("currency");
        issued.init("issued");
        issueLimit.init("issueLimit");
        expDate.init("expDate");
        status.init("status");
        createDate.init("createDate");
        walletStorage.init("walletStorage");
    }

    function init(address _contractsManager, address _wallet) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "LOCManager");
        store.set(walletStorage, _wallet);
        return OK;
    }

    function wallet() public view returns (address) {
        return store.get(walletStorage);
    }

    function sendAsset(bytes32 _symbol, address _to, uint _value) external returns (uint errorCode) {
        errorCode = multisig();
        if (OK != errorCode) {
            return _handleResult(errorCode);
        }

        var (, _token) = _getPlatformAndTokenForSymbol(_symbol);
        ReissuableWalletInterface _wallet = ReissuableWalletInterface(wallet());
        if (!_wallet.withdraw(_token, _to, _value)) {
            return _emitError(ERROR_LOC_SEND_ASSET);
        }

        _emitAssetSent(_symbol, _to, _value);
        return OK;
    }

    function reissueAsset(uint _value, bytes32 _locName) external returns (uint errorCode) {
        errorCode = multisig();
        if (OK != errorCode) {
            return _handleResult(errorCode);
        }

        if (!_isLOCActive(_locName)) {
            return _emitError(ERROR_LOC_INACTIVE);
        }

        uint _issued = store.get(issued, _locName);
        if (_value > store.get(issueLimit, _locName) - _issued) {
            return _emitError(ERROR_LOC_REQUESTED_ISSUE_VALUE_EXCEEDED);
        }

        bytes32 _symbol = store.get(currency, _locName);
        var (_platform,) = _getPlatformAndTokenForSymbol(_symbol);
        ReissuableWalletInterface _wallet = ReissuableWalletInterface(wallet());
        if (OK != _wallet.reissue(_platform, _symbol, _value)) {
            return _emitError(ERROR_LOC_REISSUING_ASSET_FAILED);
        }

        store.set(issued, _locName, _issued + _value);
        
        _emitReissue(_locName, _value);
        return OK;
    }

    function revokeAsset(uint _value, bytes32 _locName) external returns (uint errorCode) {
        errorCode = multisig();
        if (OK != errorCode) {
            return _handleResult(errorCode);
        }

        if (!_isLOCActive(_locName)) {
            return _emitError(ERROR_LOC_INACTIVE);
        }

        uint _issued = store.get(issued, _locName);
        if (_value > _issued) {
            return _emitError(ERROR_LOC_REQUESTED_REVOKE_VALUE_EXCEEDED);
        }

        bytes32 _symbol = store.get(currency, _locName);
        var (_platform,) = _getPlatformAndTokenForSymbol(_symbol);
        ReissuableWalletInterface _wallet = ReissuableWalletInterface(wallet());

        if (OK != _wallet.revoke(_platform, _symbol, _value)) {
            return _emitError(ERROR_LOC_REVOKING_ASSET_FAILED);
        }

        store.set(issued, _locName, _issued - _value);
        _emitRevoke(_locName, _value);
        errorCode = OK;

    }

    function removeLOC(bytes32 _name) external returns (uint errorCode) {
        errorCode = multisig();
        if (OK != errorCode) {
            return _handleResult(errorCode);
        }

        if (!_isLOCExist(_name)) {
            return _emitError(ERROR_LOC_NOT_FOUND);
        }

        if (_isLOCActive(_name)) {
            return _emitError(ERROR_LOC_SHOULD_NO_BE_ACTIVE);
        }

        store.remove(offeringCompaniesNames, _name);
        _cleanupLOCData(_name);
        
        _emitRemLOC(_name);
        return OK;
    }

    function addLOC(
        bytes32 _name,
        bytes32 _website,
        uint _issueLimit,
        bytes32 _publishedHash,
        uint _expDate,
        bytes32 _currency
    )
    onlyAuthorized 
    external
    returns (uint) 
    {
        require(_name != bytes32(0));
        require(_publishedHash != bytes32(0));
        require(_expDate <= now);

        ERC20ManagerInterface _erc20Manager = ERC20ManagerInterface(lookupManager("ERC20Manager"));
        require(_erc20Manager.getTokenAddressBySymbol(_currency) != 0x0);

        if (_isLOCExist(_name)) {
            return _emitError(ERROR_LOC_EXISTS);
        }

        store.add(offeringCompaniesNames, _name);
        store.set(website, _name, _website);
        store.set(issueLimit, _name, _issueLimit);
        store.set(publishedHash, _name, _publishedHash);
        store.set(expDate, _name, _expDate);
        store.set(currency, _name, _currency);
        store.set(createDate, _name, now);

        _emitNewLOC(_name, store.count(offeringCompaniesNames));
        return OK;
    }

    function setLOC(
        bytes32 _name, 
        bytes32 _newname, 
        bytes32 _website, 
        uint _issueLimit, 
        bytes32 _publishedHash, 
        uint _expDate
    ) 
    onlyAuthorized 
    external
    returns (uint) 
    {
        require(_newname != bytes32(0));
        require(_publishedHash != bytes32(0));
        require(_expDate < now);

        if (!_isLOCExist(_name)) {
            return _emitError(ERROR_LOC_NOT_FOUND);
        }

        if (_isLOCActive(_name)) {
            return _emitError(ERROR_LOC_SHOULD_NO_BE_ACTIVE);
        }

        if (_newname != _name && _isLOCExist(_newname)) {
            return _emitError(ERROR_LOC_INVALID_INVOCATION);
        }

        if (_newname != _name) {
            store.set(offeringCompaniesNames, _name, _newname);
            store.set(website, _newname, store.get(website, _name));
            store.set(issueLimit, _newname, store.get(issueLimit, _name));
            store.set(publishedHash, _newname, store.get(publishedHash, _name));
            store.set(expDate, _newname, store.get(expDate, _name));
            store.set(currency, _newname, store.get(currency, _name));
            store.set(createDate, _newname, store.get(createDate, _name));
            store.set(status, _newname, store.get(status, _name));
            _cleanupLOCData(_name);
        }

        if (!(_website == store.get(website, _newname))) {
            store.set(website, _newname, _website);
        }

        if (!(_issueLimit == store.get(issueLimit, _newname))) {
            store.set(issueLimit, _newname, _issueLimit);
        }

        if (!(_publishedHash == store.get(publishedHash, _newname))) {
            store.set(publishedHash, _newname, _publishedHash);
        }

        if (!(_expDate == store.get(expDate, _newname))) {
            store.set(expDate, _newname, _expDate);
        }

        _emitUpdateLOC(_name, _newname);
        return OK;
    }

    function setStatus(bytes32 _name, Status _status) public returns (uint errorCode) {
        errorCode = multisig();
        if (OK != errorCode) {
            return _handleResult(errorCode);
        }

        if (!_isLOCExist(_name)) {
            return _emitError(ERROR_LOC_NOT_FOUND);
        }

        uint _oldStatus = store.get(status, _name);
        if (_oldStatus == uint(_status)) {
            return _emitError(ERROR_LOC_INVALID_PARAMETER);
        }

        store.set(status, _name, uint(_status));

        _emitUpdLOCStatus(_name, _oldStatus, uint(_status));
        return OK;
    }

    function getLOCByName(bytes32 _name) public view returns (
        bytes32 _locName, 
        bytes32 _website,
        uint _issued,
        uint _issueLimit,
        bytes32 _publishedHash,
        uint _expDate,
        uint _status,
        uint _securityPercentage,
        bytes32 _currency,
        uint _createDate
    ) {
        _website = store.get(website, _name);
        _issued = store.get(issued, _name);
        _issueLimit = store.get(issueLimit, _name);
        _publishedHash = store.get(publishedHash, _name);
        _expDate = store.get(expDate, _name);
        _status = store.get(status, _name);
        _currency = store.get(currency, _name);
        _createDate = store.get(createDate, _name);
        
        return (_name, _website, _issued, _issueLimit, _publishedHash, _expDate, _status, 10, _currency, _createDate);
    }

    function getLOCById(uint _id) public view returns (
        bytes32 _locName, 
        bytes32 _website,
        uint _issued,
        uint _issueLimit,
        bytes32 _publishedHash,
        uint _expDate,
        uint _status,
        uint _securityPercentage,
        bytes32 _currency,
        uint _createDate
    ) {
        bytes32 _name = store.get(offeringCompaniesNames, _id);
        return getLOCByName(_name);
    }

    function getLOCNames() public view returns (bytes32[]) {
        return store.get(offeringCompaniesNames);
    }

    function getLOCCount() public view returns (uint) {
        return store.count(offeringCompaniesNames);
    }

    function() payable public {
        revert();
    }

    /* PRIVATE */

    function _getPlatformAndTokenForSymbol(bytes32 _symbol) private view returns (address _platform, address _token) {
        ERC20ManagerInterface _erc20Manager = ERC20ManagerInterface(lookupManager("ERC20Manager"));
        _token = _erc20Manager.getTokenAddressBySymbol(_symbol);
        _platform = ChronoBankAssetProxyInterface(_token).chronoBankPlatform();
    }

    function _isLOCExist(bytes32 _locName) private view returns (bool) {
        return store.includes(offeringCompaniesNames, _locName);
    }

    function _isLOCActive(bytes32 _locName) private view returns (bool) {
        return store.get(status, _locName) == uint(Status.active);
    }

    function _cleanupLOCData(bytes32 _locName) private {
        store.set(website, _locName, 0);
        store.set(issueLimit, _locName, 0);
        store.set(issued, _locName, 0);
        store.set(publishedHash, _locName, 0);
        store.set(expDate, _locName, 0);
        store.set(currency, _locName, 0);
        store.set(createDate, _locName, 0);
        store.set(status, _locName, 0);
    }

    function _emitNewLOC(bytes32 _locName, uint count) internal {
        LOCManagerEmitter(getEventsHistory()).emitNewLOC(_locName, count);
    }

    function _emitRemLOC(bytes32 _locName) internal {
        LOCManagerEmitter(getEventsHistory()).emitRemLOC(_locName);
    }

    function _emitUpdateLOC(bytes32 _locName, bytes32 _newName) internal {
        LOCManagerEmitter(getEventsHistory()).emitUpdateLOC(_locName, _newName);
    }

    function _emitUpdLOCStatus(bytes32 _locName, uint _oldStatus, uint _newStatus) internal {
        LOCManagerEmitter(getEventsHistory()).emitUpdLOCStatus(_locName, _oldStatus, _newStatus);
    }

    function _emitReissue(bytes32 _locName, uint _value) internal {
        LOCManagerEmitter(getEventsHistory()).emitReissue(_locName, _value);
    }

    function _emitRevoke(bytes32 _locName, uint _value) internal {
        LOCManagerEmitter(getEventsHistory()).emitRevoke(_locName, _value);
    }

    function _emitError(uint error) internal returns (uint) {
        LOCManagerEmitter(getEventsHistory()).emitError(error);
        return error;
    }

    function _emitAssetSent(bytes32 symbol, address to, uint value) internal  {
        LOCManagerEmitter(getEventsHistory()).emitAssetSent(symbol, to, value);
    }

    function _handleResult(uint error) internal returns (uint) {
        if (error != OK && error != MULTISIG_ADDED) {
            return _emitError(error);
        }
        return error;
    }
}
