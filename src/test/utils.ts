import { expect } from 'chai';
import * as path from 'path';
import { commands, Uri, window } from 'vscode';
import { BuiltInCommands } from '../constants';
import _ = require('lodash');

export type Editor = { file: string, viewColumn: number };

export function getWorkspaceFolder() {
    return path.resolve(__dirname, '../../.vscode-test/folder');
}

let groupCounter = 1;
export function newGroupName() {
    return `Group${groupCounter++}\n`;
}

export function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

function basename(uri: Uri): string;
function basename(filepath: string): string;
function basename(arg: any): string {
    let filepath = arg;
    if (arg instanceof Uri) filepath = arg.path;
    return path.basename(filepath, '.txt');
}

export async function expectEditors(uris: Uri[], extra?: {
    viewColumns?: number[], pins?: boolean[],
    editors?: Editor[]
}) {
    const editors = extra?.editors ?? await getListOfEditors();
    const viewColumns = extra?.viewColumns;
    const pins = extra?.pins;
    if (editors.length !== uris.length || (viewColumns ? uris.length !== viewColumns.length : false)
        || (pins ? pins.length !== uris.length : false))
        return expect.fail(`editors.length (${editors.length}) != uris.length (${uris.length})${viewColumns ?
            ` != viewColumns.length (${viewColumns.length})` : ''}${pins ?
                ` != pins.length (${pins.length})` : ''}`);
    if (pins) { // Open new file so closing last file in editor group doesn't change view columns for checking pins
        for (const viewColumn of _.uniq(editors.map(e => e.viewColumn))) {
            await window.showTextDocument(Uri.file(path.join(getWorkspaceFolder(), '11.txt')), { viewColumn });
        }
    }

    for (let i = 0; i < uris.length; i++) {
        const file = basename(uris[i]);
        const viewColumn = viewColumns?.[i];
        const pin = pins?.[i];
        const find = editors.find(e => e.file === file && (viewColumn ? e.viewColumn === viewColumn : true));
        if (!find)
            return expect.fail(`Could not find ${file}${viewColumn ? `(${viewColumn})` : ''} in
eds ${reprEditors(editors)}
uri ${uris.map(u => basename(u))}${viewColumns ? `
vcs ${viewColumns}` : ''}\npin ${pins ? `${pins}` : ''}`);

        if (pin !== undefined) {
            await window.showTextDocument(Uri.file(path.join(getWorkspaceFolder(), find.file + '.txt')), { viewColumn });
            await commands.executeCommand(BuiltInCommands.CloseActiveEditor);
            const isPinned = (await getListOfEditors()).find(e => e.file === file
                && (viewColumn ? e.viewColumn === viewColumn : true));
            if (pin && !isPinned)
                return expect.fail(`File not pinned ${file}${viewColumn ? `(${viewColumn})` : ''} in
eds ${reprEditors(editors)}
uri ${uris.map(u => basename(u))}${viewColumns ? `
vcs ${viewColumns}` : ''}\npin ${pins ? `${pins}` : ''}`);
            if (!pin && isPinned)
                return expect.fail(`File pinned ${file}${viewColumn ? `(${viewColumn})` : ''} in
eds ${reprEditors(editors)}
uri ${uris.map(u => basename(u))}${viewColumns ? `
vcs ${viewColumns}` : ''}\npin ${pins ? `${pins}` : ''}`);
        }
    }
}

export function reprEditors(editors: Editor): string;
export function reprEditors(editors: Editor[]): string[];
export function reprEditors(es: any): any {
    const editors = es as Editor | Editor[];
    console.log(editorToViewColumns(editors as any));
    const f = (e: Editor) => `${e.file}(${e.viewColumn})`;
    if (editors instanceof Array) {
        return editors.sort((a, b) => (a.viewColumn ?? 0) - (b.viewColumn ?? 0)).map(f);
    } else {
        return f(editors);
    }
}

export function editorToFilenames(editors: Editor): string;
export function editorToFilenames(editors: Editor[]): string[];
export function editorToFilenames(es: any): any {
    const editors = es as Editor | Editor[];
    if (editors instanceof Array) {
        return editors.map(e => e.file).sort();
    } else {
        return editors.file;
    }
}

export function editorToViewColumns(editors: Editor): number;
export function editorToViewColumns(editors: Editor[]): number[];
export function editorToViewColumns(es: any): any {
    const editors = es as Editor | Editor[];
    if (editors instanceof Array) {
        return editors.map(e => e.viewColumn).sort();
    } else {
        return editors.viewColumn;
    }
}

export async function getListOfEditors(): Promise<Editor[]> {
    await commands.executeCommand(BuiltInCommands.FocusFirstEditorGroup);
    await commands.executeCommand(BuiltInCommands.ViewFirstEditor);
    let active = window.activeTextEditor;
    if (active === undefined) return [];
    const list: { file: string, viewColumn: number }[] = [];
    do {
        if (active) {
            list.push({ file: basename(active.document.uri), viewColumn: active.viewColumn ?? 0 });
            await commands.executeCommand(BuiltInCommands.NextEditor);
            active = window.activeTextEditor;
        }
        else break;
    } while (active && (basename(active.document.uri) !== list[0].file || (active.viewColumn ?? 0) !== list[0].viewColumn));
    return list;
}
