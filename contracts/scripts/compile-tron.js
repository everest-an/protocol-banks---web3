// Use solc 0.8.20 specifically
const solc = require('solc');
const fs = require('fs');
const path = require('path');

console.log('Using solc version: 0.8.20');

// Contract files to compile
const contractFiles = [
    'contracts/tron/ITRC20.sol',
    'contracts/tron/TronPaymentVault.sol'
];

// Read contract sources
const sources = {};
const importRemappings = {
    '@openzeppelin/contracts': 'node_modules/@openzeppelin/contracts'
};

for (const file of contractFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Process imports to use local node_modules
    const processedContent = content.replace(
        /@openzeppelin\/contracts\/([^;]+)/g,
        (match, importPath) => {
            const resolvedPath = path.join(process.cwd(), 'node_modules/@openzeppelin/contracts', importPath);
            if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
            }
            return match;
        }
    );

    sources[file] = { content: processedContent };
}

// Add OpenZeppelin dependencies
const openzeppelinPath = path.join(process.cwd(), 'node_modules/@openzeppelin/contracts');
function addOpenZeppelinContracts(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && !file.name.startsWith('.')) {
            addOpenZeppelinContracts(fullPath);
        } else if (file.name.endsWith('.sol')) {
            const key = fullPath;
            sources[key] = { content: fs.readFileSync(fullPath, 'utf8') };
        }
    }
}

// Read all OpenZeppelin contracts we need
const requiredOpenZeppelinContracts = [
    'node_modules/@openzeppelin/contracts/utils/Context.sol',
    'node_modules/@openzeppelin/contracts/access/Ownable.sol',
    'node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol',
    'node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol',
    'node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol'
];

for (const ozContract of requiredOpenZeppelinContracts) {
    if (fs.existsSync(ozContract)) {
        sources[ozContract] = { content: fs.readFileSync(ozContract, 'utf8') };
    }
}

// Solidity compiler input
const input = {
    language: 'Solidity',
    sources: sources,
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};

console.log('Compiling TRON contracts...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for compilation errors
if (output.errors) {
    console.error('\n=== Compilation Errors ===');
    output.errors.forEach(error => {
        console.error(error.formattedMessage);
    });

    const hasErrors = output.errors.some(err => err.severity === 'error');
    if (hasErrors) {
        console.error('\n❌ Compilation failed!');
        process.exit(1);
    }
}

console.log('\n✅ Compilation successful!');

// Create artifacts directory
const artifactsDir = path.join(__dirname, 'artifacts/tron');
if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
}

// Extract and save ABIs and Bytecode
for (const source in output.contracts) {
    for (const contract in output.contracts[source]) {
        const contractName = contract;
        const abi = output.contracts[source][contract].abi;
        const bytecode = output.contracts[source][contract].evm.bytecode.object;

        if (bytecode && bytecode !== '0x') {
            // Save ABI
            const abiPath = path.join(artifactsDir, `${contractName}.abi.json`);
            fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
            console.log(`📄 Saved ABI: ${contractName}.abi.json`);

            // Save Bytecode
            const bytecodePath = path.join(artifactsDir, `${contractName}.bin`);
            fs.writeFileSync(bytecodePath, bytecode);
            console.log(`📦 Saved Bytecode: ${contractName}.bin`);

            // Save combined artifact
            const artifact = { abi, bytecode };
            const artifactPath = path.join(artifactsDir, `${contractName}.json`);
            fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
            console.log(`💾 Saved Artifact: ${contractName}.json`);
        }
    }
}

console.log(`\n✨ All artifacts saved to: ${artifactsDir}`);
