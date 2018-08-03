/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./StorageManager.sol";
import "../common/Owned.sol";
import "../contracts/ContractsManagerInterface.sol";


/// @title TODO:
contract StorageManagerFactory is Owned {

    uint constant OK = 1;

    bytes32[] public defaultSystemAuthorityKeys;

    function setSystemAuthorityKeys(bytes32[] _authorityKeys) 
    external
    returns (uint)
    {
        defaultSystemAuthorityKeys = _authorityKeys;
        return OK;
    }

    function createStorageManagerWithAuthorities(address _owner, address[] _authorities) 
    public 
    returns (address) 
    {
        StorageManager _storageManager = new StorageManager();
        _addAuthorities(_storageManager, _authorities);
        _storageManager.transferContractOwnership(_owner);

        return _storageManager;
    }

    function createStorageManagerWithSystemAuthorities(
        address _owner, 
        ContractsManagerInterface _contractsManager, 
        address[] _authorities
    ) 
    public 
    returns (address) 
    {
        return createStorageManagerWithSystemAuthorities(_owner, _contractsManager, defaultSystemAuthorityKeys, _authorities);
    }

    function createStorageManagerWithSystemAuthorities(
        address _owner, 
        ContractsManagerInterface _contractsManager, 
        bytes32[] _authorityKeys,
        address[] _authorities
    ) 
    public 
    returns (address) 
    {
        StorageManager _storageManager = new StorageManager();
        _addAuthorities(_storageManager, _authorities);

        if (address(_contractsManager) != 0x0) {
            address[] memory _systemAuthorities = new address[](_authorityKeys.length);
            for (uint _idx = 0; _idx < _authorityKeys.length; ++_idx) {
                _systemAuthorities[_idx] = _contractsManager.getContractAddressByType(_authorityKeys[_idx]);
            }
            _addAuthorities(_storageManager, _systemAuthorities);
        }
        _storageManager.transferContractOwnership(_owner);

        return _storageManager;
    }

    function _addAuthorities(StorageManager _storageManager, address[] _authorities) private {
        for (uint _idx = 0; _idx < _authorities.length; ++_idx) {
            if (_authorities[_idx] != 0x0) {
                _storageManager.authorize(_authorities[_idx]);
            }
        }
    }
}
