import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const workspace = process.cwd();
const sourceFiles = [
  "contracts/src/GangsterPriceOracle.sol",
  "contracts/src/GangsterHoldingOracle.sol",
  "contracts/src/RandomnessResolver.sol",
  "contracts/src/ATMGameMath.sol",
  "contracts/src/ATMGame.sol",
  "contracts/src/GangSystem.sol",
  "contracts/src/IHoodATMGameActions.sol",
  "contracts/script/DeployHoodATMInfrastructure.s.sol",
  "contracts/script/DeployHoodATM.s.sol",
  "contracts/test/ATMGame.t.sol",
];

const sources = Object.fromEntries(
  sourceFiles.map((file) => [file, { content: fs.readFileSync(path.join(workspace, file), "utf8") }]),
);

function findImports(importPath) {
  if (importPath.startsWith("forge-std/")) {
    const forgePath = path.join(
      workspace,
      "contracts/lib/forge-std/src",
      importPath.slice("forge-std/".length),
    );
    if (fs.existsSync(forgePath)) return { contents: fs.readFileSync(forgePath, "utf8") };
  }
  const candidates = [
    path.join(workspace, importPath),
    path.join(workspace, "contracts/src", importPath),
    path.join(workspace, "node_modules", importPath),
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match
    ? { contents: fs.readFileSync(match, "utf8") }
    : { error: `Import not found: ${importPath}` };
}

const output = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 0 },
    metadata: { bytecodeHash: "none" },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
}), { import: findImports }));

const diagnostics = output.errors ?? [];
for (const diagnostic of diagnostics) {
  const stream = diagnostic.severity === "error" ? process.stderr : process.stdout;
  stream.write(`${diagnostic.formattedMessage}\n`);
}

if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) process.exit(1);

for (const [sourceName, contractName] of [
  ["contracts/src/ATMGame.sol", "ATMGame"],
  ["contracts/src/GangSystem.sol", "GangSystem"],
  ["contracts/src/GangsterPriceOracle.sol", "GangsterPriceOracle"],
  ["contracts/src/GangsterHoldingOracle.sol", "GangsterHoldingOracle"],
  ["contracts/src/RandomnessResolver.sol", "RandomnessResolver"],
  ["contracts/src/ATMGameMath.sol", "ATMGameMath"],
]) {
  const bytecode = output.contracts[sourceName][contractName].evm.deployedBytecode.object;
  const size = bytecode.length / 2;
  process.stdout.write(`${contractName} deployed bytecode: ${size} bytes\n`);
  if (size > 24_576) {
    process.stderr.write(`${contractName} exceeds the EVM 24,576-byte deployed-code limit.\n`);
    process.exit(1);
  }
}

const compiledContracts = Object.values(output.contracts)
  .flatMap((contracts) => Object.keys(contracts))
  .sort();
process.stdout.write(`Compiled ${compiledContracts.length} contracts: ${compiledContracts.join(", ")}\n`);
