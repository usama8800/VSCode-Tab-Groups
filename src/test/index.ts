import * as fs from 'fs';
import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import { workspace } from 'vscode';
import { Configurations } from '../constants';

export async function run(): Promise<void> {
    // Create the mocha test

    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        inlineDiffs: true,
        timeout: Number.POSITIVE_INFINITY,
        slow: 5000,
        bail: true,
    });

    const testsRoot = path.resolve(__dirname);
    await workspace.getConfiguration('').update('window.restoreFullscreen', true, true);
    await workspace.getConfiguration('').update('window.newWindowDimensions', 'maximized', true);
    await workspace.getConfiguration('').update('workbench.editor.decorations.badges', false, true);
    // await workspace.getConfiguration('').update('workbench.editor.openPositioning', 'last', true);
    await workspace.getConfiguration('').update(Configurations.SaveGlobally, false, true);

    return new Promise((c, e) => {
        const secondTime = fs.existsSync(path.resolve(testsRoot, '..', '..', '.vscode-test', 'folder', '12.txt'));
        const globPattern = secondTime ? './suite/**/**.spec.js' : './suite/**/**.test.js';
        glob(globPattern, { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach(f => {
                mocha.addFile(path.resolve(testsRoot, f));
            });

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err1) {
                e(err1);
            }
        });
    });
}
