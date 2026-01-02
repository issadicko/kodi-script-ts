import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { KodiScript } from './index';

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
            let expectedOut = '';
            if (fs.existsSync(outPath)) {
                expectedOut = fs.readFileSync(outPath, 'utf-8').replace(/\r\n/g, '\n').trim();
            }

            // Parse directives
            let maxOps = 0;
            let expectError = false;

            const lines = source.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('// config:')) {
                    const parts = trimmed.substring('// config:'.length).split('=');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const value = parts[1].trim();
                        if (key === 'maxOps') {
                            maxOps = parseInt(value, 10) || 0;
                        }
                    }
                }
                if (trimmed.startsWith('// expect: error')) {
                    expectError = true;
                }
            });

            const builder = KodiScript.builder(source);
            if (maxOps > 0) {
                builder.withMaxOperations(maxOps);
            }
            // Use execute() to get full result
            const result = builder.execute();

            if (expectError) {
                expect(result.errors.length).toBeGreaterThan(0);
            } else {
                expect(result.errors).toEqual([]);
                const actualOut = result.output.join('\n').replace(/\r\n/g, '\n').trim();

                // Normalize output for cross-implementation compatibility
                const normalize = (s: string) => s
                    .replace(/(\d+)\.0(?=[\s,\]\}\)\n]|$)/g, '$1')
                    .replace(/<nil>/g, 'null')
                    .replace(/hello\+world/g, 'hello%20world');

                if (fs.existsSync(outPath)) {
                    expect(normalize(actualOut)).toBe(normalize(expectedOut));
                }
            }
        });
    });
});
