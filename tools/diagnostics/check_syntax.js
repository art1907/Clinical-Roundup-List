const fs = require('fs');
const path = require('path');
try {
    const code = fs.readFileSync(path.join(__dirname, '..', 'temp', 'temp_script.js'), 'utf8');
    // Wrap in function to check basic syntax, because 'return' is allowed only there? 
    // No, temp_script.js is global script.
    // Use Function constructor to check parsing.
    new Function(code);
    console.log('Syntax OK');
} catch (e) {
    console.log('Syntax Error:');
    console.log(e.message); 
    // If syntax error, it might not provide line number but let's see.
    // Or node -c output would be better but I can't see it?
}