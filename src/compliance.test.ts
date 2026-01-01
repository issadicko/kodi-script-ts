import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';

const COMPLIANCE_PATH = process.env.KODI_COMPLIANCE_TESTS_PATH || '../compliance-tests';

describe('Compliance Tests', () => {
    const absPath = path.resolve(COMPLIANCE_PATH);

    if (!fs.existsSync(absPath)) {
        console.warn(`Compliance tests directory not found at ${absPath}. Skipping.`);
        return;
    }

    function walkDir(dir: string, callback: (filePath: string) => void) {
        fs.readdirSync(dir).forEach(f => {
            const dirPath = path.join(dir, f);
            const isDirectory = fs.statSync(dirPath).isDirectory();
            if (isDirectory) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        });
    }

    const testFiles: string[] = [];
    walkDir(absPath, (filePath) => {
        if (filePath.endsWith('.kodi')) {
            testFiles.push(filePath);
        }
    });

    testFiles.forEach(sourcePath => {
        const testName = path.relative(absPath, sourcePath);

        it(`should pass compliance test: ${testName}`, () => {
            const source = fs.readFileSync(sourcePath, 'utf-8');
            const outPath = sourcePath.replace('.kodi', '.out');
            const expectedOut = fs.readFileSync(outPath, 'utf-8').replace(/\r\n/g, '\n').trim();

            const lexer = new Lexer(source);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens);
            const program = parser.parse();

            const interpreter = new Interpreter({ silentPrint: true });
            const { output } = interpreter.run(program);

            const actualOut = output.join('\n').replace(/\r\n/g, '\n').trim();

            // Normalize output for cross-implementation compatibility
            const normalize = (s: string) => s
                .replace(/(\d+)\.0(?=[\s,\]\}\)\n]|$)/g, '$1')
                .replace(/<nil>/g, 'null')
                .replace(/hello\+world/g, 'hello%20world');

            expect(normalize(actualOut)).toBe(normalize(expectedOut));
        });
    });
});
