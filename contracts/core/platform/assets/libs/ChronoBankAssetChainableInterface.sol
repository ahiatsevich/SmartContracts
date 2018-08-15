/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


contract ChronoBankAssetChainableInterface {

    function assetType() public pure returns (bytes32);

    function previousAsset() external view returns (ChronoBankAssetChainableInterface);
    function nextAsset() external view returns (ChronoBankAssetChainableInterface);

    function chainAssets(ChronoBankAssetChainableInterface[] _assets) external returns (bool);
    function __chainAssetsFromIdx(ChronoBankAssetChainableInterface[] _assets, uint _startFromIdx) external returns (bool);

    function finalizeAssetChaining() public;
}