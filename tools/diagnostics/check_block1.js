const fs = require('fs');
const path = require('path');
try {
    const code = fs.readFileSync(path.join(__dirname, 'block1.js'), 'utf8');
    // Log length
    console.log('Script Length:', code.length);
    new Function(code);
    console.log('Syntax OK');
} catch (e) {
    console.log('Syntax Error:');
    console.log(e.message);
    // Try to approximate line number if possible
    if (e.stack) {
        // Line number in 'new Function' might correspond to line in string.
        // It's offset by 2 if function body has preamble? No.
        // Usually it says "Unexpected token ... at <anonymous>:line:col".
        console.log(e.stack.split('\n')[0]); 
    }
}