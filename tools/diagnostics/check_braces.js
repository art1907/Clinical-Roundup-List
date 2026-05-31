const fs = require('fs');
const path = require('path');
let code = fs.readFileSync(path.join(__dirname, 'block1.js'), 'utf8');
code += "\n}"; // Append a brace
try {
    new Function(code);
    console.log('Syntax OK with +1 brace');
} catch (e2) {
    if (e2.message.includes('end of input')) {
        console.log('Still unexpected end of input (+1 brace not enough)');
        code += "\n}"; // Append another brace
        try {
            new Function(code);
            console.log('Syntax OK with +2 braces');
        } catch (e3) {
            console.log(`Still failed with +2 braces: ${e3.message}`);
        }
    } else {
        console.log(`Failed with +1 brace: ${e2.message}`);
    }
}