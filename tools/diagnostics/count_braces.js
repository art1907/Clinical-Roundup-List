const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'block1.js'), 'utf8');
let open = 0, close = 0;
// Ignore comments and strings roughly
let inString = false, inComment = false, inRegex = false;
for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (inString) {
        if (char === inString) inString = false;
        else if (char === '\\') i++;
    } else if (inComment) {
        if (code[i] === '\n') inComment = false;
    } else if (inRegex) {
        if (char === '/') inRegex = false;
        else if (char === '\\') i++;
    } else {
        if (char === '"' || char === "'" || char === '`') inString = char;
        else if (char === '/' && code[i+1] === '/') { inComment = true; i++; }
        else if (char === '/' && code[i+1] === '*') { /* Block comment handling is complex */ }
        else if (char === '{') open++;
        else if (char === '}') close++;
    }
}
console.log(`Open: ${open}, Close: ${close}, Diff: ${open - close}`);