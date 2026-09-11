import { network } from "hardhat";

async function main() {
    console.log("Deploying EvidenceRegistry...");

    const { ethers } = await network.connect();
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "POL/ETH");

    const factory = await ethers.getContractFactory("EvidenceRegistry");
    const deployTx = await factory.getDeployTransaction();
    const estimatedGas = await ethers.provider.estimateGas(deployTx);
    console.log("Estimated deployment gas:", estimatedGas.toString());

    const feeData = await ethers.provider.getFeeData();

    // Set custom EIP-1559 gas caps so max cost is ~0.0107 POL, fitting within user's 0.0125 POL balance
    const maxPriorityFeePerGas = ethers.parseUnits("30", "gwei");
    const maxFeePerGas = ethers.parseUnits("40", "gwei");

    const gasLimit = (estimatedGas * 110n) / 100n; // 10% safety buffer
    const estimatedCost = gasLimit * maxFeePerGas;

    console.log("Max Priority Fee:", ethers.formatUnits(maxPriorityFeePerGas, "gwei"), "gwei");
    console.log("Max Fee Per Gas:", ethers.formatUnits(maxFeePerGas, "gwei"), "gwei");
    console.log("Estimated max deployment cost:", ethers.formatEther(estimatedCost), "POL");

    const contract = await factory.deploy({
        gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas,
    });

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("\n==================================================");
    console.log("🎉 EvidenceRegistry successfully deployed!");
    console.log("📍 Contract Address:", address);
    console.log("==================================================\n");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});