pragma solidity ^0.4.11;

contract FeeInterface {
    // Fee collecting address, immutable.
    address public feeAddress;

    // Fee percent, immutable. 1 is 0.01%, 10000 is 100%.
    uint32 public feePercent;

    function calculateFee(uint _value) returns(uint);

    function setupFee(address _feeAddress, uint32 _feePercent) returns (bool);

    function setFeeAddress(address _feeAddress) returns (bool);

    function setFee(uint32 _feePercent);
}
