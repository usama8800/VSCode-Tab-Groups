import { expect } from 'chai';
import * as path from 'path';
import { commands, TextEditor, Uri, window } from 'vscode';
import { TextEditorComparer } from '../comparers';
import { BuiltInCommands } from '../constants';

export function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

export async function expectEditors(uris: Uri[], extra?: { viewColumns?: number[], pins?: boolean[], editors?: TextEditor[] }) {
    const editors = extra?.editors ?? await getListOfEditors();
    const viewColumns = extra?.viewColumns;
    const pins = extra?.pins;
    if (editors.length !== uris.length || (viewColumns ? uris.length !== viewColumns.length : false)
        || (pins ? pins.length !== uris.length : false))
        return expect.fail(`editors.length (${editors.length}) != uris.length (${uris.length})${viewColumns ?
            ` != viewColumns.length (${viewColumns.length})` : ''}${pins ?
                ` != pins.length (${pins.length})` : ''}`);

    for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const viewColumn = viewColumns?.[i];
        const pin = pins?.[i];
        const find = editors.find(e => e.document.fileName === uri.fsPath && (viewColumn ? e.viewColumn === viewColumn : true));
        if (!find)
            return expect.fail(`Could not find ${path.basename(uri.fsPath)}${viewColumn
                ? `(${viewColumn})` : ''} in ${reprEditors(editors)}`);

        if (pin !== undefined) {
            await window.showTextDocument(find.document, viewColumn);
            await commands.executeCommand(BuiltInCommands.CloseActiveEditor);
            const isPinned = (await getListOfEditors()).find(e => e.document.fileName === uri.fsPath
                && (viewColumn ? e.viewColumn === viewColumn : true));
            if (pin && !isPinned)
                return expect.fail(`File not pinned ${path.basename(uri.fsPath)}${viewColumn ? `(${viewColumn})` : ''}`);
            if (!pin && isPinned)
                return expect.fail(`File pinned ${path.basename(uri.fsPath)}${viewColumn ? `(${viewColumn})` : ''}`);
        }
    }
}

export function reprEditors(editors: TextEditor): string;
export function reprEditors(editors: TextEditor[]): string[];
export function reprEditors(es: any): any {
    const editors = es as TextEditor | TextEditor[];
    const f = (e: TextEditor) => `${path.basename(e.document.uri.path)}(${e.viewColumn}) `;
    if (editors instanceof Array) {
        return editors.map(f).sort();
    } else {
        return f(editors);
    }
}

export function editorToFilenames(editors: TextEditor): string;
export function editorToFilenames(editors: TextEditor[]): string[];
export function editorToFilenames(es: any): any {
    const editors = es as TextEditor | TextEditor[];
    if (editors instanceof Array) {
        return editors.map(e => path.basename(e.document.uri.path)).sort();
    } else {
        return path.basename(editors.document.uri.path);
    }
}

export function editorToViewColumns(editors: TextEditor): number;
export function editorToViewColumns(editors: TextEditor[]): number[];
export function editorToViewColumns(es: any): any {
    const editors = es as TextEditor | TextEditor[];
    if (editors instanceof Array) {
        return editors.map(e => e.viewColumn).sort();
    } else {
        return editors.viewColumn;
    }
}

export async function getListOfEditors(): Promise<TextEditor[]> {
    await commands.executeCommand(BuiltInCommands.FocusFirstEditorGroup);
    await commands.executeCommand(BuiltInCommands.ViewFirstEditor);
    const first = window.activeTextEditor;
    if (first === undefined) return [];
    let active = window.activeTextEditor;
    const list: TextEditor[] = [];
    do {
        if (active) {
            list.push(active);
            await commands.executeCommand(BuiltInCommands.NextEditor);
            active = window.activeTextEditor;
        }
        else break;
    } while (!TextEditorComparer.equals(first, active, { useId: false, usePosition: true }));
    return list;
}
