import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { runTests } from 'vscode-test';

export function getWorkspaceFolder() {
    return path.resolve(__dirname, '../../.vscode-test/folder');
}

async function readyWorkspace(workspaceFolderPath: string) {
    if (fs.existsSync(workspaceFolderPath)) fs.rmSync(workspaceFolderPath, { recursive: true, force: true });
    if (fs.mkdirSync(workspaceFolderPath, { recursive: true }) !== workspaceFolderPath) throw Error('Could not ready workspace');

    const git = simpleGit({ baseDir: workspaceFolderPath });
    await git.init();

    Array.from({ length: 10 }, (_, i) => fs.writeFileSync(path.resolve(workspaceFolderPath, `${i + 1}.txt`), ''));
}

async function main() {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index');

    const workspaceFolderPath = getWorkspaceFolder();
    try {
        await readyWorkspace(workspaceFolderPath);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    if (process.argv[2] === 'readyOnly') return;
    // Download VS Code, unzip it and run the integration test
    try {
        const ret = await runTests({
            extensionDevelopmentPath, extensionTestsPath,
            launchArgs: [workspaceFolderPath, '--disable-extensions'],
            // vscodeExecutablePath: path.resolve(extensionDevelopmentPath, './.vscode-test/vscode-1.67.0/Code.exe')
            version: '1.67.0',
        });
        console.log(ret);
        if (ret === 0) {
            fs.writeFileSync(path.resolve(workspaceFolderPath, '12.txt'), '');
            await runTests({
                extensionDevelopmentPath, extensionTestsPath,
                launchArgs: [workspaceFolderPath, '--disable-extensions'],
                // vscodeExecutablePath: path.resolve(extensionDevelopmentPath, './.vscode-test/vscode-1.67.0/Code.exe')
                version: '1.67.0',
            });
        }
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

if (require.main === module) main();
