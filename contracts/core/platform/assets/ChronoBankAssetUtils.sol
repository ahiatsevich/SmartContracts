/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./libs/ChronoBankAssetChainableInterface.sol";


library ChronoBankAssetUtils {

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

            _next = _next.getNextAsset();
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

            _next = _next.getNextAsset();
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

            _next = _next.getNextAsset();
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
            _previousAsset = _head.getPreviousAsset();
            if (address(_previousAsset) == 0x0) {
                return _head;
            }
            _head = _previousAsset;
        } while (true);
    }
}