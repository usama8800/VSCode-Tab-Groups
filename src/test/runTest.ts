import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { runTests } from 'vscode-test';

async function readyWorkspace(workspaceFolderPath: string) {
    if (fs.existsSync(workspaceFolderPath)) fs.rmSync(workspaceFolderPath, { recursive: true, force: true });
    if (fs.mkdirSync(workspaceFolderPath, { recursive: true }) !== workspaceFolderPath) throw Error('Could not ready workspace');

    const git = simpleGit({ baseDir: workspaceFolderPath });
    await git.init();

    // 1-10 to open
    // 11 to check for pins
    Array.from({ length: 11 }, (_, i) => fs.writeFileSync(path.resolve(workspaceFolderPath, `${i + 1}.txt`), ''));
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');

        const workspaceFolderPath = path.resolve(extensionDevelopmentPath, './.vscode-test/folder');
        await readyWorkspace(workspaceFolderPath);

        if (process.argv[2] === 'readyOnly') return;
        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath, extensionTestsPath,
            launchArgs: [workspaceFolderPath, '--disable-extensions'],
            vscodeExecutablePath: path.resolve(extensionDevelopmentPath, './.vscode-test/vscode-1.56.2/Code.exe')
        });
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
