/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "../../ChronoBankAssetInterface.sol";
import "../../ChronoBankAssetProxyInterface.sol";
import "../libs/ChronoBankAssetChainableInterface.sol";


contract ChronoBankAssetRouterInterface is ChronoBankAssetInterface, ChronoBankAssetChainableInterface {

    function init(ChronoBankAssetProxyInterface _proxy, bool _finalizeChaining) public returns (bool);
}
