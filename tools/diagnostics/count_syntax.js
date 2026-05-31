const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, 'block1.js'), 'utf8');

let stack = [];
let inString = null; // " ' `
let inComment = false; // //
let inBlockComment = false; // /* */
let inRegex = false; // /.../ (tricky)

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = content[i-1];
    const next = content[i+1];

    if (inString) {
        if (char === inString && prev !== '\\') inString = null;
        continue;
    }
    if (inComment) {
        if (char === '\n') inComment = false;
        continue;
    }
    if (inBlockComment) {
        if (char === '*' && next === '/') { inBlockComment = false; i++; }
        continue;
    }
    
    // Check regex? Only if previous token suggests value? Hard.
    // Assume / is division unless clearly regex? No.
    // Let's ignore regex for brace matching for now, except simple ones.
    
    if (char === '/' && next === '/') { inComment = true; i++; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }
    
    if (char === '"' || char === "'" || char === '`') { inString = char; continue; }
    
    if (char === '{' || char === '(' || char === '[') {
        stack.push({ char, index: i, line: content.substring(0, i).split('\n').length });
    } else if (char === '}' || char === ')' || char === ']') {
        if (stack.length === 0) {
            console.log(`Unmatched ${char} at line ${content.substring(0, i).split('\n').length}`);
        } else {
            const open = stack.pop();
            const expected = open.char === '{' ? '}' : open.char === '(' ? ')' : ']';
            if (char !== expected) {
                console.log(`Mismatched ${open.char} (line ${open.line}) with ${char} at line ${content.substring(0, i).split('\n').length}`);
            }
        }
    }
}

if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed ${s.char} at line ${s.line}`));
} else {
    console.log("Braces/Parens/Brackets Balanced.");
}