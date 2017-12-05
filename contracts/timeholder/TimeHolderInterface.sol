pragma solidity ^0.4.11;

import {ERC20Interface as Asset} from "../core/erc20/ERC20Interface.sol";

contract TimeHolderInterface {

    function wallet() constant returns (address);
    function totalShares() constant returns (uint);
    function sharesContract() constant returns (address);
    function shareholdersCount() constant returns (uint);
    function totalSupply() constant returns(uint);
    function depositBalance(address _address) constant returns(uint);
    function takeFeatureFee(address _account, uint _amount) returns (uint resultCode);
}
