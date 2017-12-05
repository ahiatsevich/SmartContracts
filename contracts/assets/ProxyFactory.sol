pragma solidity ^0.4.11;

import {ChronoBankAssetProxy as Proxy} from "../core/platform/ChronoBankAssetProxy.sol";
import "../core/platform/ChronoBankAssetWithFee.sol";

contract ProxyFactory {

    function createAsset() returns(address) {
        address asset;
        asset = new ChronoBankAsset();
        return asset;
    }

    function createAssetWithFee(address owner) returns(address) {
        ChronoBankAssetWithFee asset;
        asset = new ChronoBankAssetWithFee();
        asset.transferContractOwnership(owner);
        return asset;
    }

    function createProxy() returns(address) {
        address proxy = new Proxy();
        return proxy;
    }

    function() {
        revert();
    }
}
