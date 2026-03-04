import fs from 'fs';
import { parse } from '@babel/parser';

const code = fs.readFileSync('src/pages/Motos.jsx', 'utf8');

try {
    parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log('No syntax errors found.');
} catch (err) {
    console.error('Syntax error found:');
    console.error(`Message: ${err.message}`);
    console.error(`Location: line ${err.loc.line}, column ${err.loc.column}`);

    const lines = code.split('\n');
    const start = Math.max(0, err.loc.line - 3);
    const end = Math.min(lines.length, err.loc.line + 2);
    for (let i = start; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
        if (i + 1 === err.loc.line) {
            console.log(' '.repeat(err.loc.column + (String(i + 1).length + 2)) + '^');
        }
    }
}
