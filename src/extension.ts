import * as vscode from 'vscode';
import { ActiveEditorTracker } from './activeEditorTracker';
import { TextEditorComparer } from './comparers';
import { Groups } from './group';

let groups = new Groups();
let latestGroup: string;

export function activate(context: vscode.ExtensionContext) {
	let disposables = [
		vscode.commands.registerCommand('extension.saveGroup', saveGroup),
		vscode.commands.registerCommand('extension.clearAndSaveGroup', async () => {
			const success = await saveGroup();
			if (!success) { return; }
			await closeAllEditors();
		}),
		vscode.commands.registerCommand('extension.updateGroup', async () => {
			const name = await vscode.window.showQuickPick(groups.listOfNames(), {
				canPickMany: false,
				placeHolder: 'Which tab group would you like to update?',
			});
			if (name === undefined) { return; }
			latestGroup = name;

			groups.remove(name);
			const openEditors = await getListOfEditors();
			groups.add(name, openEditors.map(e => e.document).filter(e => e));
		}),
		vscode.commands.registerCommand('extension.updateLastGroup', async () => {
			if (!latestGroup) {
				vscode.window.showWarningMessage('No last group');
				return;
			}
			groups.remove(latestGroup);
			const openEditors = await getListOfEditors();
			groups.add(latestGroup, openEditors.map(e => e.document).filter(e => e));
		}),
		vscode.commands.registerCommand('extension.restoreGroup', async () => {
			if (groups.length() === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		vscode.commands.registerCommand('extension.clearAndRestoreGroup', async () => {
			if (groups.length() === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await closeAllEditors();
			await restoreGroup(groupName);
		}),
		vscode.commands.registerCommand('extension.deleteGroup', async () => {
			if (groups.length() === 0) {
				vscode.window.showInformationMessage("No saved groups");
				return;
			}
			const groupName = await vscode.window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
	];
	context.subscriptions.concat(disposables);
}

export function deactivate() { }

async function saveGroup(): Promise<boolean> {
	let name = await vscode.window.showInputBox({
		placeHolder: 'Enter name for group or empty for default name'
	});
	if (name === undefined) { return false; }
	name = name.trim();
	if (name === '') { name = groups.newGroupName(); }

	if (groups.listOfNames().includes(name)) {
		const overwrite = await vscode.window.showInputBox({
			placeHolder: 'Tab group already exists. Do you want to overwrite?',
			validateInput: value => {
				value = value.toLowerCase();
				if (value.startsWith('y') || value.startsWith('n')) {
					return;
				}
				return 'Please enter y or n';
			},
		});
		if (overwrite === undefined || overwrite.startsWith('n')) { return false; }
		else {
			groups.remove(name);
		}
	}

	latestGroup = name;
	const openEditors = await getListOfEditors();
	groups.add(name, openEditors.map(e => e.document).filter(e => e));
	return true;
}

async function restoreGroup(groupName: string | undefined) {
	if (groupName === undefined) { return; }
	const group = groups.get(groupName);
	if (!group) { return; }
	group.list.forEach(document => vscode.window.showTextDocument(document, {
		preview: false,
	}));
}

async function closeAllEditors(): Promise<void> {
	const editorTracker = new ActiveEditorTracker();

	let editor = vscode.window.activeTextEditor;
	do {
		await editorTracker.awaitClose();
		editor = vscode.window.activeTextEditor;
	} while (editor !== undefined);
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
