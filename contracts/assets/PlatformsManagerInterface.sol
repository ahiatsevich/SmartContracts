pragma solidity ^0.4.11;

contract PlatformsManagerInterface {
    function getPlatformForUserAtIndex(address _user, uint _idx) public constant returns (address _platform);
    function getPlatformsForUserCount(address _user) public constant returns (uint);

    function getPlatformsMetadataForUser(address _user) public constant returns (address[] _platforms);

    function isPlatformAttached(address _platform) public constant returns (bool);
}
