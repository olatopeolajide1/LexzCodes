const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  console.log(`› Deploying to network: ${network}`);
  console.log(`› Deployer: ${deployer.address}`);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`› Balance: ${hre.ethers.formatEther(bal)} ETH`);
  if (network === "sepolia" && bal < hre.ethers.parseEther("0.005")) {
    throw new Error("Insufficient Sepolia ETH. Faucets: https://www.alchemy.com/faucets/ethereum-sepolia · https://cloud.google.com/application/web3/faucet/ethereum/sepolia · https://sepolia-faucet.pk910.de");
  }

  console.log("› Deploying Groth16Verifier ...");
  const verifier = await hre.ethers.deployContract("Groth16Verifier");
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();

  console.log("› Deploying AgeVerifier ...");
  const age = await hre.ethers.deployContract("AgeVerifier", [verifierAddr]);
  await age.waitForDeployment();
  const ageAddr = await age.getAddress();

  console.log("\n════════════════════════════════════════");
  console.log(`Groth16Verifier: ${verifierAddr}`);
  console.log(`AgeVerifier:     ${ageAddr}`);
  console.log("════════════════════════════════════════");
  console.log("› Put the AgeVerifier address in dapp/src/config.js and README.md");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
