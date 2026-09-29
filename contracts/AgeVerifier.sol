// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Groth16Verifier } from "./Groth16Verifier.sol";

/// @title AgeVerifier
/// @notice Verifies zero-knowledge proofs that a user is at least 18 years old
///         WITHOUT revealing their birthdate, the reference date used, or the
///         exact age. Generated with snarkjs (`zkey export solidityverifier`).
/// @dev Public signals (snarkjs order — circuit output first):
///        pubSignals[0] = nullifier (Poseidon(year, month, day, secret))
///        pubSignals[1] = minAgeYears  (must equal 18 — enforced here on-chain)
///        pubSignals[2] = refDay
///        pubSignals[3] = refMonth
///        pubSignals[4] = refYear
///      A fresh nullifier is required per verification, so proofs cannot be
///      replayed or shared between wallets.
contract AgeVerifier {
    /// @notice Required minimum age, hard-coded on-chain.
    uint256 public constant MIN_AGE_YEARS = 18;

    /// @notice Emitted when a fresh proof (new nullifier) is accepted.
    event AgeVerified(address indexed account, uint256 nullifier, uint256 timestamp);

    /// @notice Emitted when a proof with an already-used nullifier is rejected.
    event DoubleAttemptBlocked(address indexed account, uint256 nullifier);

    Groth16Verifier public immutable verifier;

    /// @notice nullifier => true once it has been accepted on-chain.
    mapping(uint256 => bool) public nullifierUsed;

    /// @notice account => true once that account has a valid on-chain attestation.
    mapping(address => bool) public isVerifiedAdult;

    /// @param verifierAddress address of the generated Groth16Verifier contract.
    constructor(address verifierAddress) {
        require(verifierAddress != address(0), "AgeVerifier: zero verifier");
        verifier = Groth16Verifier(verifierAddress);
    }

    /// @notice Verify a Groth16 proof of "I am at least 18 years old".
    /// @param _pA,_pB,_pC Groth16 proof points (as returned by snarkjs.groth16.exportSolidityCallData).
    /// @param _pubSignals [nullifier, minAgeYears, refDay, refMonth, refYear].
    /// @return true if the proof is valid and the nullifier was fresh.
    function verifyAgeProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[5] calldata _pubSignals
    ) external returns (bool) {
        uint256 nullifier = _pubSignals[0];

        if (nullifierUsed[nullifier]) {
            emit DoubleAttemptBlocked(msg.sender, nullifier);
            revert("AgeVerifier: nullifier already used (copied proof)");
        }

        // Pin the policy on-chain: the circuit's public `minAgeYears` must be 18.
        require(_pubSignals[1] == MIN_AGE_YEARS, "AgeVerifier: minAge must be 18");

        require(
            verifier.verifyProof(_pA, _pB, _pC, _pubSignals),
            "AgeVerifier: invalid proof"
        );

        nullifierUsed[nullifier] = true;
        isVerifiedAdult[msg.sender] = true;

        emit AgeVerified(msg.sender, nullifier, block.timestamp);
        return true;
    }

    /// @notice Read-only check used by third parties before granting access.
    function hasVerifiedAdult(address account) external view returns (bool) {
        return isVerifiedAdult[account];
    }
}
