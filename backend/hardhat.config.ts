import "dotenv/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatEthers],

  paths: {
    sources: "./blockchain",
  },

  solidity: {
    profiles: {
      default: {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },

      production: {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },

    polygonAmoy: {
      type: "http",
      chainType: "l1",
      url: process.env.POLYGON_AMOY_RPC_URL!,
      accounts: [process.env.BLOCKCHAIN_PRIVATE_KEY!],
    },
  },
});