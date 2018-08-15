/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "../../ChronoBankAssetInterface.sol";
import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "../../ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "../../ChronoBankPlatformInterface.sol";
import "../../../storage/Storage.sol";
import "../ChronoBankAssetUtils.sol";
import "../routers/ChronoBankAssetAbstractCore.sol";
import "./ChronoBankAssetChainableInterface.sol";


contract ChronoBankAssetChainableCore {

    uint constant ASSETS_CHAIN_MAX_LENGTH = 20;

    ChronoBankAssetChainableInterface public previousAsset;
    ChronoBankAssetChainableInterface public nextAsset;
    bool public chainingFinalized;

    string public version = "v0.0.1";
}


contract ChronoBankAssetChainableImpl is 
    ChronoBankAssetChainableCore, 
    ChronoBankAssetChainableInterface 
{  
    modifier onlyNotFinalizedChaining {
        require(chainingFinalized == false, "ASSET_CHAIN_SHOULD_NOT_BE_IN_FINALIZED_CHAINING");
        _;
    }

    function getChainedAssets() 
    public
    view
    returns (bytes32[] _types, address[] _assets) 
    {
        return ChronoBankAssetUtils.getChainedAssets(this);
    }

    function getAssetByType(bytes32 _assetType)
    public
    view
    returns (address)
    {
        return ChronoBankAssetUtils.getAssetByType(this, _assetType);
    }

    function chainAssets(ChronoBankAssetChainableInterface[] _assets)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(_assets.length - 1 <= ASSETS_CHAIN_MAX_LENGTH, "ASSET_CHAIN_MAX_ASSETS_EXCEEDED");
        require(address(previousAsset) == 0x0, "ASSET_CHAIN_HEAD_ASSET_SHOULD_NOT_HAVE_PREVIOUS_LINK");
        
        if (_assets.length == 0) {
            return false;
        }

        return _chainAssets(_assets, 0);
    }

    function _chainAssets(ChronoBankAssetChainableInterface[] _assets, uint _startFromIdx)
    private
    returns (bool _result)
    {
        nextAsset = _assets[_startFromIdx];
        require(
            ChronoBankAssetChainableImpl(_assets[_startFromIdx]).__setPreviousAsset(this), 
            "ASSET_CHAIN_CANNOT_SETUP_PREVIOUS_IN_CHAIN");

        _result = ChronoBankAssetChainableImpl(_assets[_startFromIdx]).__chainAssetsFromIdx(_assets, _startFromIdx + 1);
        if (_result) {
            chainingFinalized = true;
        }
    }

    function __chainAssetsFromIdx(ChronoBankAssetChainableInterface[] _assets, uint _startFromIdx)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(msg.sender == address(previousAsset), "ASSET_CHAIN_SENDER_SHOULD_BE_ASSET");
        require(_assets[_startFromIdx - 1] == this, "ASSET_CHAIN_RECEIVER_SHOULD_BE_FIRST_IN_ARRAY");
        
        if (_startFromIdx >= _assets.length) {
            chainingFinalized = true;
            return true;
        }

        return _chainAssets(_assets, _startFromIdx);
    }

    function __setPreviousAsset(ChronoBankAssetChainableInterface _asset)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(msg.sender == address(_asset), "ASSET_CHAIN_SENDER_SHOULD_SEND_HIMSELF");
        // require(address(_asset.nextAsset()) == address(this), "Only when `next` property set to the current asset");
        previousAsset = _asset;

        return true;
    }

    function finalizeAssetChaining()
    public
    {
        if (!chainingFinalized) {
            chainingFinalized = true;
        }
    }
}