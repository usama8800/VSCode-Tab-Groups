import { expect } from 'chai';
import * as robot from 'kbm-robot';
import * as path from 'path';
import { commands, Uri, window, workspace } from 'vscode';
import { BuiltInCommands, Commands } from '../../constants';
import { delay, expectEditors } from '../utils';

describe('Save and Restore', () => {
    let workspaceFolder: string;
    before(() => {
        if (!workspace.workspaceFolders) return expect.fail('No workspace folder open');
        workspaceFolder = workspace.workspaceFolders[0].uri.path;
    });

    beforeEach(async () => {
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
    });

    it('Single file, default name', async () => {
        const fileuri = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri, { preview: false });
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString('Group 1').type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri]);
    });

    it('Two files, single editor group', async function () {
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await window.showTextDocument(fileuri2, { preview: false });
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri1, fileuri2], { viewColumns: [1, 1] });
    });

    it('Two files, different editor groups', async function () {
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri1, fileuri2], { viewColumns: [1, 2] });
    });

    it('One file, different editor groups', async function () {
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri1, fileuri2], { viewColumns: [1, 2] });
    });

    it('Single pinned file', async function () {
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri1], { pins: [true] });
    });

    it.only('Two pinned files, same editor group', async function () {
        this.timeout(Infinity);
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        await window.showTextDocument(fileuri2, { preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        await delay(3000);
        let wait = commands.executeCommand(Commands.Save);
        await delay(3000);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        await delay(3000);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await delay(100000);
        await expectEditors([fileuri1, fileuri2], { pins: [true, true] });
    });

    it('Two pinned files, different editor group', async function () {
        const fileuri1 = Uri.file(path.join(workspaceFolder, './1.txt'));
        const fileuri2 = Uri.file(path.join(workspaceFolder, './2.txt'));
        await window.showTextDocument(fileuri1, { viewColumn: 1, preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        await window.showTextDocument(fileuri2, { viewColumn: 2, preview: false });
        await commands.executeCommand(BuiltInCommands.PinEditor);
        let wait = commands.executeCommand(Commands.Save);
        robot.startJar();
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        await wait;
        await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
        wait = commands.executeCommand(Commands.Restore);
        await delay(100);
        await robot.typeString(this.test?.title).type('ENTER').go();
        robot.stopJar();
        await wait;
        await expectEditors([fileuri1, fileuri2], { viewColumns: [1, 2], pins: [true, true] });
    });

    it('10 * random different editor groups', async function () {
        const tests = 10;
        this.timeout(this.timeout() * tests);
        this.slow(this.slow() * tests);
        for (let i = 0; i < tests; i++) {
            await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
            const numFiles = ((Math.trunc(Math.random() * 100)) % 10) + 1;
            const filenames = `${Math.random()}`.slice(2).split('').map(s => +s + 1).slice(0, numFiles);
            const fileUris = filenames.map(f => Uri.file(path.join(workspaceFolder, `${f}.txt`)));
            const isNewViewColumn = filenames.map((_, j) => Math.random() < 0.3 || j === 0 ? true : false);
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
            let wait = commands.executeCommand(Commands.Save);
            robot.startJar();
            await delay(100);
            await robot.typeString(this.test?.title + `${i}`).type('ENTER').go();
            await wait;
            await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
            wait = commands.executeCommand(Commands.Restore);
            await delay(100);
            await robot.typeString(this.test?.title + `${i}`).type('ENTER').go();
            robot.stopJar();
            await wait;
            await expectEditors(fileUris, { viewColumns, pins });
        }
    });
});
