import fs from 'fs';

const code = fs.readFileSync('src/pages/Motos.jsx', 'utf8');

function checkBalance(text) {
    const stack = [];
    const pairs = {
        '{': '}',
        '[': ']',
        '(': ')'
    };
    const openers = new Set(Object.keys(pairs));
    const closers = new Set(Object.values(pairs));

    // Simple state machine to ignore content inside strings and comments
    let inString = null; // ' or " or `
    let inComment = null; // // or /*

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inComment === '//') {
            if (char === '\n') inComment = null;
            continue;
        }
        if (inComment === '/*') {
            if (char === '*' && nextChar === '/') {
                inComment = null;
                i++;
            }
            continue;
        }
        if (inString) {
            if (char === inString && text[i - 1] !== '\\') {
                inString = null;
            }
            continue;
        }

        if (char === '/' && nextChar === '/') {
            inComment = '//';
            i++;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            inComment = '/*';
            i++;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            inString = char;
            continue;
        }

        if (openers.has(char)) {
            stack.push({ char, pos: i });
        } else if (closers.has(char)) {
            if (stack.length === 0) {
                return { error: 'Extra closer', char, pos: i };
            }
            const last = stack.pop();
            if (pairs[last.char] !== char) {
                return { error: 'Mismatched pair', expected: pairs[last.char], found: char, pos: i, openerPos: last.pos };
            }
        }
    }

    if (stack.length > 0) {
        return { error: 'Unclosed openers', stack };
    }
    if (inString) return { error: 'Unclosed string', inString };
    if (inComment) return { error: 'Unclosed comment', inComment };

    return { success: true };
}

const lines = code.split('\n');
function getLineCol(pos) {
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length + 1 > pos) {
            return { line: i + 1, col: pos - currentPos + 1 };
        }
        currentPos += lines[i].length + 1;
    }
    return { line: lines.length, col: lines[lines.length - 1].length };
}

const result = checkBalance(code);
if (result.success) {
    console.log('Balanced!');
} else {
    console.log('Error:', result.error);
    if (result.pos !== undefined) {
        const lc = getLineCol(result.pos);
        console.log(`At line ${lc.line}, col ${lc.col}`);
        console.log(lines[lc.line - 1]);
        console.log(' '.repeat(lc.col - 1) + '^');
    }
    if (result.stack) {
        result.stack.forEach(s => {
            const lc = getLineCol(s.pos);
            console.log(`Unclosed ${s.char} at line ${lc.line}, col ${lc.col}`);
        });
    }
}
