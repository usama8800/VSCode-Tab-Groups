import { expect } from 'chai';
import * as robot from 'kbm-robot';
import * as path from 'path';
import { commands, Uri, window, workspace } from 'vscode';
import { BuiltInCommands, Commands, serializeTabGroups } from '../../constants';
import { delay, newGroupName } from '../utils';

describe('Save and Restore', () => {
    let workspaceFolder: string;
    before(() => {
        if (!workspace.workspaceFolders) return expect.fail('No workspace folder open');
        workspaceFolder = workspace.workspaceFolders[0].uri.path;
        robot.startJar(6);
    });

    after(() => {
        robot.stopJar();
    });

    beforeEach(async () => {
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
    });

    afterEach(async () => {
        // await window.showQuickPick([{ label: 'Yes' }], { placeHolder: 'Continue', ignoreFocusOut: true });
    });

    it('Single file, default name', async function () {
        const fileuri = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri, { preview: false });
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString('\n').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString('Group 1\n').go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('Two files, single editor group', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await window.showTextDocument(fileuri2, { preview: false });
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('Two files, different editor groups', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('One file, different editor groups', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('Single pinned file', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('Two pinned files, same editor group', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        await window.showTextDocument(fileuri2, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    it('Two pinned files, different editor group', async function () {
        const groupName = newGroupName();
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(groupName).go();
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });

    const tests = 3;
    it.only(`${tests} * random different editor groups`, async function () {
        this.timeout(this.timeout() * tests);
        this.slow(this.slow() * tests);
        for (let i = 0; i < tests; i++) {
            await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
            const groupName = newGroupName();
            const numFiles = ((Math.trunc(Math.random() * 100)) % 4) + 10;
            const filenames = `${Math.random()}`.slice(2).split('').map(s => +s + 1).slice(0, numFiles);
            const fileUris = filenames.map(f => Uri.file(path.join(workspaceFolder, `${f}.txt`)));
            const isNewViewColumn = filenames.map((_, j) => Math.random() < 0.2 || j === 0 ? true : false);
            const viewColumns: number[] = [];
            let viewColumn = 0;
            let thisViewColumn: number[] = [];
            for (let j = 0; j < numFiles; j++) {
                isNewViewColumn[j] = isNewViewColumn[j] || thisViewColumn.includes(filenames[j]);
                if (isNewViewColumn[j]) {
                    viewColumn++;
                    thisViewColumn = [];
                }
                thisViewColumn.push(filenames[j]);
                viewColumns.push(viewColumn);
            }
            const pins = filenames.map(_ => Math.random() < 0.2 ? true : false);

            for (let j = 0; j < fileUris.length; j++) {
                const f = fileUris[j];
                await window.showTextDocument(f, { viewColumn: viewColumns[j], preview: false });
                if (pins[j]) await commands.executeCommand(BuiltInCommands.PinEditor);
            }
            const tabGroups = serializeTabGroups(window.tabGroups);
            let wait = commands.executeCommand(Commands.Save);
            await delay(100);
            await robot.typeString(groupName).go();
            await wait;
            await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
            wait = commands.executeCommand(Commands.Restore);
            await delay(100);
            await robot.typeString(groupName).go();
            await wait;
            const newTabGroups = serializeTabGroups(window.tabGroups);
            if (tabGroups !== newTabGroups) {
                expect.fail('Tab groups not restored');
            }
            // const error = checkTabGroups(tabGroups, window.tabGroups);
            // if (error) expect.fail(error);
        }
    });

    it.skip('Specific set', async function () {
        const auto = true;
        this.timeout(Infinity);
        const groupName = newGroupName();
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        const filenames = [2, 2, 6, 6, 3, 7, 9, 8, 2, 9, 6,];
        const fileUris = filenames.map(f => Uri.file(path.join(workspaceFolder, `${f}.txt`)));
        const viewColumns = [1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4];
        const pins = [true, false, false, false, false, false, false, false, true, false, false,];
        for (let j = 0; j < fileUris.length; j++) {
            const f = fileUris[j];
            await window.showTextDocument(f, { viewColumn: viewColumns[j], preview: false });
            if (pins[j]) await commands.executeCommand(BuiltInCommands.PinEditor);
        }
        const tabGroups = serializeTabGroups(window.tabGroups);
        let wait = commands.executeCommand(Commands.Save);
        if (auto) {
            await delay(100);
            await robot.typeString(groupName).go();
        }
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        if (auto) {
            await delay(100);
            await robot.typeString(groupName).go();
        }
        await wait;
        const newTabGroups = serializeTabGroups(window.tabGroups);
        if (tabGroups !== newTabGroups) {
            expect.fail('Tab groups not restored');
        }
        // const error = checkTabGroups(tabGroups, window.tabGroups);
        // if (error) expect.fail(error);
    });
});
