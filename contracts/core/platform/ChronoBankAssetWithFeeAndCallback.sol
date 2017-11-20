pragma solidity ^0.4.11;

import "./ChronoBankAssetWithFee.sol";
import "./ChronoBankAssetWithCallback.sol";
import "../common/Owned.sol";

/**
 * @title ChronoBank Asset With Fee and Callback implementation contract.
 */
contract ChronoBankAssetWithFeeAndCallback is ChronoBankAssetWithFee, ChronoBankAssetWithCallback {
    /**
    *  Override ChronoBankAssetWithFee#_transferWithReference()
    *
    *  Call super#_transferWithReference(), take fee and notify listeners
    *  that a transfer has been performed.
    */
    function _transferWithReference(address _to, uint _value, string _reference, address _sender)
    internal
    returns (bool result)
    {
        result = ChronoBankAssetWithFee._transferWithReference(_to, _value, _reference, _sender);
        if (result) {
            notifyOnTransfer(_sender, _value);
        }
    }
}
