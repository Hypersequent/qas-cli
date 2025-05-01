import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import { printErrorThenExit } from './misc';

export function extractProjectCode(files: string[]): string {
    for (const file of files) {
        try {
            const xmlString = readFileSync(file).toString();
            // Look for pattern like PRJ-123 or TEST-456
            const match = xmlString.match(/([A-Za-z0-9]{1,5})-\d{3,}/);
            if (match) {
                const [, projectCode] = match;
                return projectCode;
            }
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('ENOENT:')) {
                if (files.length > 1) {
                    console.error(chalk.yellow(`Warning: File ${file} does not exist`));
                } else {
                    return printErrorThenExit(`File ${file} does not exist`);
                }
            } else {
                return printErrorThenExit(`Could not read file ${file}`);
            }
        }
    }
    return printErrorThenExit('Could not detect project code from test case names in XML files. Please make sure that test case names contain a valid project code (e.g., PRJ-123)');
}