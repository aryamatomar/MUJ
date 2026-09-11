// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvidenceRegistry {

    struct EvidenceRecord {
        bytes32 evidenceHash;
        uint256 timestamp;
        address registeredBy;
    }

    mapping(bytes32 => EvidenceRecord) private records;
    mapping(bytes32 => bool) private registered;

    event EvidenceRegistered(
        bytes32 indexed incidentId,
        bytes32 evidenceHash,
        uint256 timestamp,
        address registeredBy
    );

    function registerEvidence(
        bytes32 incidentId,
        bytes32 evidenceHash
    ) external {
        require(incidentId != bytes32(0), "Invalid incident ID");
        require(evidenceHash != bytes32(0), "Invalid evidence hash");
        require(!registered[incidentId], "Already registered");

        records[incidentId] = EvidenceRecord({
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            registeredBy: msg.sender
        });

        registered[incidentId] = true;

        emit EvidenceRegistered(
            incidentId,
            evidenceHash,
            block.timestamp,
            msg.sender
        );
    }

    function getEvidence(bytes32 incidentId)
        external
        view
        returns (
            bytes32,
            uint256,
            address
        )
    {
        require(registered[incidentId], "Incident not found");

        EvidenceRecord memory record = records[incidentId];

        return (
            record.evidenceHash,
            record.timestamp,
            record.registeredBy
        );
    }

    function isEvidenceRegistered(bytes32 incidentId)
        external
        view
        returns (bool)
    {
        return registered[incidentId];
    }
}