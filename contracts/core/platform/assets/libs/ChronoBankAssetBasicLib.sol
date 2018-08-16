/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetBasicLibAbstract.sol";
import "./ChronoBankAssetChainableImpl.sol";


contract ChronoBankAssetBasicLib is 
    ChronoBankAssetBasicLibAbstract,
    ChronoBankAssetChainableImpl
{    
    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetBasic";
    }
}