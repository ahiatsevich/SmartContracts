/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../core/common/Owned.sol";
import "../core/common/OwnedInterface.sol";
import "../core/storage/Storage.sol";
import {ChronoBankAssetProxy as AssetProxy} from "../core/platform/ChronoBankAssetProxy.sol";
import {ChronoBankAsset as Asset} from "../core/platform/ChronoBankAsset.sol";
import {ChronoBankAssetWithFee as AssetWithFee} from "../core/platform/ChronoBankAssetWithFee.sol";
import {ChronoBankAssetPausableRouter as PausableAsset} from "../core/platform/assets/routers/ChronoBankAssetPausableRouter.sol";
import {ChronoBankAssetBlacklistableRouter as BlacklistableAsset} from "../core/platform/assets/routers/ChronoBankAssetBlacklistableRouter.sol";
import {ChronoBankAssetRouter as AssetBasic} from "../core/platform/assets/routers/ChronoBankAssetRouter.sol";
import {ChronoBankAssetWithFeeRouter as AssetBasicWithFee} from "../core/platform/assets/routers/ChronoBankAssetWithFeeRouter.sol";
import {ChronoBankAssetWithFeeRouterInterface as AssetBasicWithFeeInterface} from "../core/platform/assets/routers/ChronoBankAssetWithFeeRouter.sol";

//import {ChronoBankAssetWithCallback as AssetWithCallback} from "../core/platform/ChronoBankAssetWithCallback.sol";
//import {ChronoBankAssetWithFeeAndCallback as AssetWithFeeAndCallback} from "../core/platform/ChronoBankAssetWithFeeAndCallback.sol";


contract AssetFactoryInterface {
    function createAsset(address _storage, bytes32 _crate) public returns (address);
}


contract OwnedAssetFactoryInterface {
    function createOwnedAsset(address _owner, address _storage, bytes32 _crate) public returns (address);
}


/// @title Implementation of token and proxy factory.
/// Creates instances of ChronoBank assets and proxies
contract TokenFactory is Owned {

    /// @dev Mapping (factory type key => address)
    mapping (bytes32 => address) public factories;

    /// @notice Add asset factory with given type to registry
    function setAssetFactory(bytes32 _type, address _factory) public onlyContractOwner returns (bool) {
        require(_type != 0x0, "TOKEN_FACTORY_INVALID_FACTORY_TYPE");
        factories[_type] = _factory;
    }

    /// @notice Creates ChronoBankAssetProxy contract
    function createProxy() public returns (address) {
        return new AssetProxy();
    }

    /// @notice Creates asset contract
    function createAsset(bytes32 _type, address _storage, bytes32 _crate) public returns (address) {
        require(factories[_type] != 0x0, "TOKEN_FACTORY_PROVIDED_TYPE_NOT_FOUND");
        return AssetFactoryInterface(factories[_type]).createAsset(_storage, _crate);
    }

    /// @notice Creates owned asset contract
    function createOwnedAsset(bytes32 _type, address _owner, address _storage, bytes32 _crate) public returns (address) {
        require(factories[_type] != 0x0, "TOKEN_FACTORY_PROVIDED_TYPE_NOT_FOUND");
        require(_owner != 0x0, "TOKEN_FACTORY_INVALID_OWNER_ADDRESS");
        return OwnedAssetFactoryInterface(factories[_type]).createOwnedAsset(_owner, _storage, _crate);
    }
}

contract BackendBasedFactoryInterface is Owned {
    
    address public assetBackend;

    constructor(address _assetBackend) public {
        setAssetBackend(_assetBackend);
    }

    function setAssetBackend(address _assetBackend) 
    public 
    onlyContractOwner 
    returns (bool) 
    {
        require(_assetBackend != 0x0, "ASSET_BASIC_FACTORY_INVALID_BACKEND");

        assetBackend = _assetBackend;
    }

}


/// @title Creates ChronoBankAsset contract
contract ChronoBankAssetFactory is AssetFactoryInterface {

    uint constant OK = 1;

    /// @notice Creates basic asset contract
    function createAsset(address _storage, bytes32 _crate) public returns (address _asset) {
        _asset = new Asset(Storage(_storage), _crate);
    }
}

contract ChronoBankAssetBasicFactory is AssetFactoryInterface, BackendBasedFactoryInterface {

    uint constant OK = 1;

    constructor(address _assetBackend) BackendBasedFactoryInterface(_assetBackend) public {
    }

    /// @notice Creates basic asset contract
    function createAsset(address _storage, bytes32 _crate) public returns (address _asset) {
        _asset = new AssetBasic(Storage(_storage), _crate, assetBackend);
    }
}

/// @title Creates ChronoBankAssetWithFee contract
contract ChronoBankAssetWithFeeFactory is OwnedAssetFactoryInterface {

    uint constant OK = 1;
    
    /// @notice Creates asset with fee contract
    /// @param _owner of an asset
    function createOwnedAsset(address _owner, address _storage, bytes32 _crate) public returns (address) {
        AssetWithFee asset = new AssetWithFee(Storage(_storage), _crate);
        asset.transferContractOwnership(_owner);
        return asset;
    }
}

contract ChronoBankAssetBasicWithFeeFactory is OwnedAssetFactoryInterface, BackendBasedFactoryInterface {
    uint constant OK = 1;

    constructor(address _assetBackend) BackendBasedFactoryInterface(_assetBackend) public {
    }

    /// @notice Creates basic asset with fee contract
    /// @param _owner of an asset
    function createOwnedAsset(address _owner, address _storage, bytes32 _crate) public returns (address) {
        AssetBasicWithFee asset = new AssetBasicWithFee(Storage(_storage), _crate, assetBackend);
        AssetBasicWithFeeInterface(asset).transferContractOwnership(_owner);
        return asset;
    }
}

contract ChronoBankAssetPausableFactory is AssetFactoryInterface, BackendBasedFactoryInterface {
    uint constant OK = 1;

    constructor(address _assetBackend) BackendBasedFactoryInterface(_assetBackend) public {
    }

    /// @notice Creates pausable asset without any asset modification
    function createAsset(address _storage, bytes32 _crate) public returns (address _asset) {
        _asset = new PausableAsset(Storage(_storage), _crate, assetBackend);
    }
}

contract ChronoBankAssetBlacklistableFactory is AssetFactoryInterface, BackendBasedFactoryInterface {
    uint constant OK = 1;

    constructor(address _assetBackend) BackendBasedFactoryInterface(_assetBackend) public {
    }
    
    /// @notice Creates blacklistable asset without any asset modification
    function createAsset(address _storage, bytes32 _crate) public returns (address _asset) {
        _asset = new BlacklistableAsset(Storage(_storage), _crate, assetBackend);
    }
}

/**
* @dev Creates ChronoBankAssetWithCallback contract
*/
/*contract ChronoBankAssetWithCallbackFactory is OwnedAssetFactoryInterface {
    function createOwnedAsset(address _owner)
    public
    returns (address)
    {
        AssetWithCallback asset = new AssetWithCallback();
        asset.transferContractOwnership(_owner);
        return asset;
    }
}*/

/**
* @dev Creates ChronoBankAssetWithFeeAndCallback contract
*/
/*contract ChronoBankAssetWithFeeAndCallbackFactory is OwnedAssetFactoryInterface {
    function createOwnedAsset(address _owner)
    public
    returns (address)
    {
        AssetWithFeeAndCallback asset = new AssetWithFeeAndCallback();
        asset.transferContractOwnership(_owner);
        return asset;
    }
}*/
