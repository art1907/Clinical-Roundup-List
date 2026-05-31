const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'block1.js'), 'utf8');
const lines = code.split('\n');
let buffer = '';
let lastError = null;
let lastErrorLine = 0;

console.log(`Analyzing ${lines.length} lines...`);

for (let i = 0; i < lines.length; i++) {
    buffer += lines[i] + '\n';
    try {
        new Function(buffer);
        // If successful, we just closed a statement/block validly.
        // We continue to see if next lines break it?
        // No by default a valid prefix is valid JS.
        // But if we have valid JS, and add 'function foo() {', it becomes invalid (end of input).
    } catch (e) {
        if (e.message.includes('Unexpected end of input')) {
            // Normal, inside block
        } else {
            // REAL Syntax Error! (e.g. unexpected token)
            console.log(`Syntax Error at line ${i + 1}: ${e.message}`);
            console.log(`Line content: ${lines[i]}`);
            process.exit(1);
        }
    }
}
console.log("Finished. If no error printed, prob unexpected end of input at very end.");