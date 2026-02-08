const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Contract files to compile
const contractFiles = [
    'contracts/tron/ITRC20.sol',
    'contracts/tron/TronPaymentSplitter.sol'
];

// Read contract sources and resolve imports
function findImports(importPath) {
    // Handle OpenZeppelin imports
    if (importPath.startsWith('@openzeppelin/contracts/')) {
        const relativePath = importPath.replace('@openzeppelin/contracts/', '');
        const fullPath = path.join(__dirname, '..', 'node_modules', '@openzeppelin', 'contracts', relativePath);
        if (fs.existsSync(fullPath)) {
            return { contents: fs.readFileSync(fullPath, 'utf8') };
        }
    }
    return { error: 'File not found' };
}

// Read contract sources
const sources = {};
for (const file of contractFiles) {
    const fullPath = path.join(__dirname, '..', file);
    sources[file] = { content: fs.readFileSync(fullPath, 'utf8') };
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

console.log('Compiling TronPaymentSplitter...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

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
const artifactsDir = path.join(__dirname, '..', 'artifacts/tron');
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
