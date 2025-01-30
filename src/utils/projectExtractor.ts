import { readFileSync } from 'fs';
import chalk from 'chalk';

export function extractProjectCode(files: string[]): string {
    for (const file of files) {
        try {
            const xmlString = readFileSync(file).toString();
            // Look for pattern like PRJ-123 or TEST-456
            const match = xmlString.match(/([A-Z]+)-\d{3,}/);
            if (match) {
                const [, projectCode] = match;
                return projectCode;
            }
        } catch (error) {
            console.error(chalk.yellow(`Warning: Could not read file ${file}`));
        }
    }
    throw new Error('Could not detect project code from test case names in XML files. Please make sure that test case names contain a valid project code (e.g., PRJ-123)');
}