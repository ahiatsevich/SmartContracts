pragma solidity ^0.4.11;

contract OwnedInterface {
   function claimContractOwnership() returns(bool);
   function changeContractOwnership(address _to) returns(bool);
   function transferContractOwnership(address _to) public returns (bool);
}
