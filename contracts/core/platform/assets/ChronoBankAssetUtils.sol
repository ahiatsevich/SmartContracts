/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./libs/ChronoBankAssetChainableInterface.sol";
import "../../storage/Storage.sol";
import "../../storage/StorageInterface.sol";
import {ChronoBankAssetProxyInterface as Proxy} from "../ChronoBankAssetProxyInterface.sol";


library ChronoBankAssetUtils {

    using StorageInterface for StorageInterface.Config;

    uint constant ASSETS_CHAIN_MAX_LENGTH = 20;

    function getChainedAssets(ChronoBankAssetChainableInterface _asset) 
    public
    view
    returns (bytes32[] _types, address[] _assets) 
    {
        bytes32[] memory _tempTypes = new bytes32[](ASSETS_CHAIN_MAX_LENGTH);
        address[] memory _tempAssets = new address[](ASSETS_CHAIN_MAX_LENGTH);

        ChronoBankAssetChainableInterface _next = getHeadAsset(_asset);
        uint _counter = 0;
        do {
            _tempTypes[_counter] = _next.assetType();
            _tempAssets[_counter] = address(_next);
            _counter += 1;

            _next = _next.nextAsset();
        } while (address(_next) != 0x0);

        _types = new bytes32[](_counter);
        _assets = new address[](_counter);
        for (uint _assetIdx = 0; _assetIdx < _counter; ++_assetIdx) {
            _types[_assetIdx] = _tempTypes[_assetIdx];
            _assets[_assetIdx] = _tempAssets[_assetIdx];
        }
    }

    function getAssetByType(ChronoBankAssetChainableInterface _asset, bytes32 _assetType)
    public
    view
    returns (address)
    {
        ChronoBankAssetChainableInterface _next = getHeadAsset(_asset);
        do {
            if (_next.assetType() == _assetType) {
                return address(_next);
            }

            _next = _next.nextAsset();
        } while (address(_next) != 0x0);
    }

    function containsAssetInChain(ChronoBankAssetChainableInterface _asset, address _checkAsset)
    public
    view
    returns (bool)
    {
        ChronoBankAssetChainableInterface _next = getHeadAsset(_asset);
        do {
            if (address(_next) == _checkAsset) {
                return true;
            }

            _next = _next.nextAsset();
        } while (address(_next) != 0x0);
    }

    function getHeadAsset(ChronoBankAssetChainableInterface _asset)
    public
    view
    returns (ChronoBankAssetChainableInterface)
    {
        ChronoBankAssetChainableInterface _head = _asset;
        ChronoBankAssetChainableInterface _previousAsset;
        do {
            _previousAsset = _head.previousAsset();
            if (address(_previousAsset) == 0x0) {
                return _head;
            }
            _head = _previousAsset;
        } while (true);
    }

    /// @notice Sets asset proxy address.
    /// Can be set only once.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function _initAssetLib(
        address _asset, 
        StorageInterface.Config storage _store, 
        StorageInterface.Address storage _proxyStorage, 
        address _gotProxy, 
        address _newProxy, 
        bool _finalizeChaining
    )
    internal 
    returns (bool) 
    {
        require(
            address(_store.store) == Proxy(_newProxy).chronoBankPlatform(), 
            "ASSET_LIB_INVALID_STORAGE_INITIALIZED"
        );

        if (_finalizeChaining) {
            ChronoBankAssetChainableInterface(_asset).finalizeAssetChaining();
        }

        if (_gotProxy != 0x0 && _newProxy == _gotProxy) {
            return true;
        }

        if (_gotProxy != 0x0) {
            return false;
        }

        _store.set(_proxyStorage, _newProxy);
        return true;
    }
}