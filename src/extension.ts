import * as vscode from 'vscode';
import { ActiveEditorTracker } from './activeEditorTracker';
import { TextEditorComparer } from './comparers';

interface Group {
	name: string;
	list: vscode.TextDocument[];
}

let groups: Group[] = [];

export function activate(context: vscode.ExtensionContext) {
	let disposables = [
		vscode.commands.registerCommand('extension.saveGroup', async () => {
			let name = await vscode.window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return; }
			name = name.trim();
			if (name === '') { name = `Group${groups.length}`; }

			const openEditors = await getListOfEditors();
			const group: Group = { list: openEditors.map(e => e.document).filter(e => e), name };
			groups.push(group);
		}),
		vscode.commands.registerCommand('extension.clearAndSaveGroup', async () => {
			let name = await vscode.window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return; }
			name = name.trim();
			if (name === '') { name = `Group${groups.length}`; }

			const openEditors = await getListOfEditors();
			const group: Group = { list: openEditors.map(e => e.document).filter(e => e), name };
			groups.push(group);
			await closeAllEditors();
		}),
		vscode.commands.registerCommand('extension.restoreGroup', async () => {
			if (groups.length === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.map(g => g.name));
			restoreGroup(groupName);
		}),
		vscode.commands.registerCommand('extension.clearAndRestoreGroup', async () => {
			if (groups.length === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.map(g => g.name));
			await closeAllEditors();
			await restoreGroup(groupName);
		}),
		vscode.commands.registerCommand('extension.deleteGroup', async () => {
			if (groups.length === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.map(g => g.name));
			if (groupName === undefined) { return; }
			groups = groups.filter(g => g.name !== groupName);
		}),
	];
	context.subscriptions.concat(disposables);
}

export function deactivate() { }

async function restoreGroup(groupName: string | undefined) {
	if (groupName === undefined) { return; }
	const group = groups.find(g => g.name === groupName);
	if (!group) { return; }
	group.list.forEach(async document => await vscode.window.showTextDocument(document, {
		preview: false,
	}));
}

async function closeAllEditors(): Promise<void> {
	const editorTracker = new ActiveEditorTracker();

	let active = vscode.window.activeTextEditor;
	let editor = active;
	const openEditors = [];
	do {
		if (editor !== null) {
			// If we didn't start with a valid editor, set one once we find it
			if (active === undefined) {
				active = editor;
			}

			openEditors.push(editor);
		}

		editor = await editorTracker.awaitClose();
		if (editor !== undefined &&
			openEditors.some(_ => TextEditorComparer.equals(_, editor, { useId: true, usePosition: true }))) { break; }
	} while ((active === undefined && editor === undefined) ||
		!TextEditorComparer.equals(active, editor, { useId: true, usePosition: true }));
	editorTracker.dispose();
}

async function getListOfEditors(): Promise<(vscode.TextEditor)[]> {
	const editorTracker = new ActiveEditorTracker();

	let active = vscode.window.activeTextEditor;
	let editor = active;
	const openEditors = [];
	do {
		if (editor !== null) {
			// If we didn't start with a valid editor, set one once we find it
			if (active === undefined) {
				active = editor;
			}

			openEditors.push(editor);
		}

		editor = await editorTracker.awaitNext(500);
		if (editor !== undefined &&
			openEditors.some(_ => TextEditorComparer.equals(_, editor, { useId: true, usePosition: true }))) { break; }
	} while ((active === undefined && editor === undefined) ||
		!TextEditorComparer.equals(active, editor, { useId: true, usePosition: true }));
	editorTracker.dispose();

	const ret = [];
	for (let index = 0; index < openEditors.length; index++) {
		const element = openEditors[index];
		if (element) { ret.push(element); }
	}
	return ret;
}
