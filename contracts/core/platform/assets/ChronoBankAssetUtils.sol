/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;

interface ChronoBankAssetChainable {
    function previousAsset() external view returns (ChronoBankAssetChainable);
    function nextAsset() external view returns (ChronoBankAssetChainable);
    function assetType() external pure returns (bytes32);
}

library ChronoBankAssetUtils {

    uint constant ASSETS_CHAIN_MAX_LENGTH = 20;

    function getChainedAssets(ChronoBankAssetChainable _asset) 
    public
    view
    returns (bytes32[] _types, address[] _assets) 
    {
        bytes32[] memory _tempTypes = new bytes32[](ASSETS_CHAIN_MAX_LENGTH);
        address[] memory _tempAssets = new address[](ASSETS_CHAIN_MAX_LENGTH);

        ChronoBankAssetChainable _next = getHeadAsset(_asset);
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

    function getAssetByType(ChronoBankAssetChainable _asset, bytes32 _assetType)
    public
    view
    returns (address)
    {
        ChronoBankAssetChainable _next = getHeadAsset(_asset);
        do {
            if (_next.assetType() == _assetType) {
                return address(_next);
            }

            _next = _next.nextAsset();
        } while (address(_next) != 0x0);
    }

    function containsAssetInChain(ChronoBankAssetChainable _asset, address _checkAsset)
    public
    view
    returns (bool)
    {
        ChronoBankAssetChainable _next = getHeadAsset(_asset);
        do {
            if (address(_next) == _checkAsset) {
                return true;
            }

            _next = _next.nextAsset();
        } while (address(_next) != 0x0);
    }

    function getHeadAsset(ChronoBankAssetChainable _asset)
    public
    view
    returns (ChronoBankAssetChainable)
    {
        ChronoBankAssetChainable _head = _asset;
        ChronoBankAssetChainable _previousAsset;
        do {
            _previousAsset = _head.previousAsset();
            if (address(_previousAsset) == 0x0) {
                return _head;
            }
            _head = _previousAsset;
        } while (true);
    }
}