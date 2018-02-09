pragma solidity ^0.4.11;

import "../core/common/Owned.sol";
import "../core/common/OwnedInterface.sol";
import {ChronoBankAssetProxy as AssetProxy} from "../core/platform/ChronoBankAssetProxy.sol";
import {ChronoBankAsset as Asset} from "../core/platform/ChronoBankAsset.sol";
import {ChronoBankAssetWithFee as AssetWithFee} from "../core/platform/ChronoBankAssetWithFee.sol";
import {ChronoBankAssetWithCallback as AssetWithCallback} from "../core/platform/ChronoBankAssetWithCallback.sol";
import {ChronoBankAssetWithFeeAndCallback as AssetWithFeeAndCallback} from "../core/platform/ChronoBankAssetWithFeeAndCallback.sol";


contract AssetFactoryInterface {
    function createAsset() public returns (address);
}


contract OwnedAssetFactoryInterface {
    function createOwnedAsset(address owner) public returns (address);
}


/// @title Implementation of token and proxy factory.
/// Creates instances of ChronoBank assets and proxies
contract TokenFactory is Owned {
    mapping (bytes32 => address) public factories;

    /// @notice Add asset factory with given type to registry
    /// @param _type type of factory
    /// @param _factory address of factory contract
    /// @return `true` if success, `false` otherwise
    function setAssetFactory(bytes32 _type, address _factory)
    public
    onlyContractOwner
    returns (bool)
    {
        require(_type != 0x0);
        factories[_type] = _factory;
    }

    /// @notice Creates ChronoBankAssetProxy contract
    function createProxy() public returns (address) {
        return new AssetProxy();
    }

    /// @notice Creates asset contract
    /// @param _type type of factory (and asset)
    function createAsset(bytes32 _type) public returns (address) {
        require(factories[_type] != 0x0);
        return AssetFactoryInterface(factories[_type]).createAsset();
    }

    /// @notice Creates owned asset contract
    /// @param _type type of factory (and asset)
    /// @param _owner user that will be owner of an asset
    function createOwnedAsset(bytes32 _type, address _owner)
    public
    returns (address)
    {
        require(factories[_type] != 0x0);
        require(_owner != 0x0);
        return OwnedAssetFactoryInterface(factories[_type]).createOwnedAsset(_owner);
    }
}


/// @title Creates ChronoBankAsset contract
contract ChronoBankAssetFactory is AssetFactoryInterface {

    /// @notice Creates standart asset without any tastes
    function createAsset() public returns (address) {
        return new Asset();
    }
}


/// @title Creates ChronoBankAssetWithFee contract
contract ChronoBankAssetWithFeeFactory is OwnedAssetFactoryInterface {

    /// @notice Creates owned asset with provided address as an owner
    function createOwnedAsset(address _owner)
    public
    returns (address)
    {
        AssetWithFee asset = new AssetWithFee();
        asset.transferContractOwnership(_owner);
        return asset;
    }
}


/// @title Creates ChronoBankAssetWithCallback contract
contract ChronoBankAssetWithCallbackFactory is OwnedAssetFactoryInterface {

    /// @notice Creates owned asset with callback and with provided address as an owner
    function createOwnedAsset(address _owner)
    public
    returns (address)
    {
        AssetWithCallback asset = new AssetWithCallback();
        asset.transferContractOwnership(_owner);
        return asset;
    }
}


/// @title Creates ChronoBankAssetWithFeeAndCallback contract
contract ChronoBankAssetWithFeeAndCallbackFactory is OwnedAssetFactoryInterface {

    /// @notice Creates owned asset with fee and callback and with provided address as an owner
    function createOwnedAsset(address _owner)
    public
    returns (address)
    {
        AssetWithFeeAndCallback asset = new AssetWithFeeAndCallback();
        asset.transferContractOwnership(_owner);
        return asset;
    }
}
