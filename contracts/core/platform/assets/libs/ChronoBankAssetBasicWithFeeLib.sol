/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetBasicLibAbstract.sol";
import "./ChronoBankAssetChainableImpl.sol";
import "../routers/ChronoBankAssetWithFeeRouter.sol";
import "../../../common/Owned.sol";


contract ChronoBankAssetBasicWithFeeLib is 
    ChronoBankAssetBasicLibAbstract,
    ChronoBankAssetWithFeeCore,
    Owned,
    ChronoBankAssetChainableImpl
{    
    /// @dev Allows the call if fee was successfully taken, throws if the call failed in the end.
    modifier takeFee(address _from, uint _fromValue, address _sender, bool[1] memory _success) {
        if (_transferFee(_from, _fromValue, _sender)) {
            _;
            if (!_success[0] && _subjectToFees(_from, _fromValue)) {
                revert("Cannot take fee");
            }
        }
    }


    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetBasicWithFee";
    }

    function feeAddress() 
    public 
    view 
    returns (address) 
    {
        return store.get(feeAddressStorage);
    }

    function feePercent() 
    public 
    view 
    returns (uint32) 
    {
        return uint32(store.get(feePercentStorage));
    }

    /// @notice Sets fee collecting address and fee percent.
    /// @param _feeAddress fee collecting address.
    /// @param _feePercent fee percent, 1 is 0.01%, 10000 is 100%.
    /// @return success.
    function setupFee(address _feeAddress, uint32 _feePercent) 
    public 
    onlyContractOwner 
    returns (bool) 
    {
        setFee(_feePercent);
        return setFeeAddress(_feeAddress);
    }

    /// @notice Sets fee address separate from setting fee percent value. Can be set only once
    /// @param _feeAddress fee collecting address
    /// @return result of the operation
    function setFeeAddress(address _feeAddress) 
    public 
    onlyContractOwner 
    returns (bool) 
    {
        if (feeAddress() == _feeAddress) {
            return false;
        }

        store.set(feeAddressStorage, _feeAddress);
        return true;
    }

    /// @notice Sets fee percent value. Can be changed multiple times
    /// @param _feePercent fee percent, 1 is 0.01%, 10000 is 100%.
    function setFee(uint32 _feePercent) 
    public 
    onlyContractOwner 
    {
        store.set(feePercentStorage, _feePercent);
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _afterTransferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool)
    {
        return _afterTransferWithReference(
            _to, 
            _value, 
            _reference, 
            _sender, 
            [false]
        );
    }

    /// @dev Transfers asset balance from the specified sender to specified receiver adding specified comment.
    ///
    /// Will be executed only in case of successful fee payment from the sender.
    ///
    /// @param _to holder address to give to.
    /// @param _value amount to transfer.
    /// @param _reference transfer comment to be included in a platform's Transfer event.
    /// @param _sender initial caller.
    /// @param _success function-modifier shared scope, so that modifier knows the result of a call.
    ///
    /// @return success.
    function _afterTransferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender, 
        bool[1] memory _success
    ) 
    internal 
    takeFee(_sender, _value, _sender, _success) 
    returns (bool) 
    {
        _success[0] = super._afterTransferWithReference(
            _to, 
            _value, 
            _reference, 
            _sender
        );
        return _success[0];
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _afterTransferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool)
    {
        return _afterTransferFromWithReference(
            _from, 
            _to, 
            _value, 
            _reference, 
            _sender, 
            [false]
        );
    }

    /// @dev Performs allowance transfer of asset balance from the specified 
    ///     payer to specified receiver adding specified comment.
    ///
    /// Will be executed only in case of successful fee payment from the payer.
    ///
    /// @param _from holder address to take from.
    /// @param _to holder address to give to.
    /// @param _value amount to transfer.
    /// @param _reference transfer comment to be included in a platform's Transfer event.
    /// @param _sender initial caller.
    /// @param _success function-modifier shared scope, so that modifier knows the result of a call.
    ///
    /// @return success.
    function _afterTransferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender, 
        bool[1] memory _success
    ) 
    internal 
    takeFee(_from, _value, _sender, _success) 
    returns (bool) 
    {
        _success[0] = super._afterTransferFromWithReference(
            _from, 
            _to, 
            _value, 
            _reference, 
            _sender
        );
        return _success[0];
    }

    /// @dev Transfers fee from the specified payer to fee collecting address.
    /// Will be executed only if payer and amount are subjects to fees.
    /// @param _feeFrom payer to take fee from.
    /// @param _fromValue amount to apply fee percent.
    /// @param _sender initial caller.
    /// @return success.
    function _transferFee(
        address _feeFrom, 
        uint _fromValue, 
        address _sender
    ) 
    internal 
    returns (bool) 
    {
        if (!_subjectToFees(_feeFrom, _fromValue)) {
            return true;
        }
        
        return super._afterTransferFromWithReference(
            _feeFrom, 
            feeAddress(), 
            calculateFee(_fromValue), 
            "Transaction fee",
            _sender
        );
    }

    /// @dev Check if specified payer and amount are subjects to fees.
    /// Fee is not taken if:
    ///  - Fee collecting address is not set;
    ///  - Payer is fee collecting address itself;
    ///  - Amount equals 0;
    /// @return true if fee needs to be taken.
    function _subjectToFees(address _feeFrom, uint _fromValue) 
    internal 
    view 
    returns (bool) 
    {
        address _feeAddress = feeAddress();
        return _feeAddress != 0x0
            && _feeAddress != _feeFrom
            && _fromValue != 0;
    }

    /// @notice Return fee that needs to be taken based on specified amount.
    /// Fee amount is always rounded up.
    /// @return fee amount.
    function calculateFee(uint _value) 
    public 
    view 
    returns (uint) 
    {
        uint feeRaw = _value * feePercent();
        return (feeRaw / 10000) + (feeRaw % 10000 == 0 ? 0 : 1);
    }
}