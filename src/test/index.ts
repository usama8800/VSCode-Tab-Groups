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
        timeout: 7000,
        slow: 5000,
    });

    const testsRoot = path.resolve(__dirname, '..');
    await workspace.getConfiguration('').update('window.restoreFullscreen', false, true);
    await workspace.getConfiguration('').update(Configurations.SaveGlobally, false, true);

    return new Promise((c, e) => {
        glob('./test/suite/**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

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
