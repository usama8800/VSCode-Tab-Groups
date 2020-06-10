import * as vscode from 'vscode';
import { commands } from 'vscode';
import { ActiveEditorTracker } from './activeEditorTracker';
import { TextEditorComparer } from './comparers';
import { BuiltInCommands } from './constants';
import { Groups, SplitTreeItem, TreeItem, TreeItemType } from './group';
import { API, GitExtension } from './typings/git';

let groups = new Groups();
let latestGroup: string;
let latestBranch: string | undefined;

export function activate(context: vscode.ExtensionContext) {

	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
	const git = gitExtension?.getAPI(1);
	const gitBranchGroups = vscode.workspace.getConfiguration().get('tab-groups.gitBranchGroups');

	if (git?.state === 'initialized') {
		initGitBranchGroups(git);
	}

	git?.onDidChangeState(e => {
		if (e === 'initialized' && gitBranchGroups) {
			initGitBranchGroups(git);
		}
	});
	vscode.workspace.onDidChangeConfiguration(change => {
		if (change.affectsConfiguration('tab-groups.gitBranchGroups') && git) {
			if (gitBranchGroups) {
				initGitBranchGroups(git);
			}
		}
	});
	vscode.window.registerTreeDataProvider('tab-groups-groups', groups);

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
			updateGroup(name);
		}),
		vscode.commands.registerCommand('extension.updateLastGroup', async () => {
			if (!latestGroup) {
				vscode.window.showWarningMessage('No last group');
				return;
			}
			updateGroup(latestGroup);
		}),
		vscode.commands.registerCommand('extension.saveGroupFromView', async (item: TreeItem) => {
			if (item === undefined) {
				return saveGroup();
			}

			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = item.getText();

			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await updateGroup(groupName);
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
		vscode.commands.registerCommand('extension.restoreGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = item.getText();

			const action: string = vscode.workspace.getConfiguration().get('tab-groups.sidebarRestoreStyle', 'Keep others');
			if (action.startsWith('Update current;')) {
				await updateGroup(groupName);
			}
			if (action.endsWith('Close others')) {
				await closeAllEditors();
			}

			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		vscode.commands.registerCommand('extension.renameGroup', async (item: TreeItem) => {
			const oldName = await vscode.window.showQuickPick(groups.listOfNames(), {
				canPickMany: false,
				placeHolder: 'Which tab group would you like to rename?',
			});
			if (oldName === undefined) { return; }

			let name = await vscode.window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return false; }
			name = name.trim();
			if (name === '') { name = groups.newGroupName(); }

			renameGroup(oldName, name);
		}),
		vscode.commands.registerCommand('extension.renameGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = item.getText();

			if (groupName === undefined) { return; }
			latestGroup = groupName;

			let name = await vscode.window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return false; }
			name = name.trim();
			if (name === '') { name = groups.newGroupName(); }

			renameGroup(groupName, name);
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
		vscode.commands.registerCommand('extension.closeAllEditors', () => {
			commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
		}),
		vscode.commands.registerCommand('extension.deleteGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}

			const groupName = item.getText();
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
		vscode.commands.registerCommand('extension.deleteEditorGroupFromView', async (item: TreeItem) => {
			if (item.getType() === TreeItemType.GROUP) {
				return;
			}
			let groupItem = item.getParent();
			let isFile = false;
			if (groupItem?.getType() !== TreeItemType.GROUP) {
				groupItem = groupItem?.getParent();
				isFile = true;
			}

			const groupName = groupItem?.getText();
			if (groupName === undefined) { return; }
			latestGroup = groupName;

			if (isFile) { groups.removeFile(groupName, item); }
			else { groups.removeViewColumn(groupName, (item as SplitTreeItem).getViewColumn()); }
		}),
	];
	context.subscriptions.concat(disposables);
}

export function deactivate() { }

function initGitBranchGroups(git: API) {
	if (git.repositories.length === 0) { return; }

	const repo = git.repositories[0];
	latestBranch = repo.state.HEAD?.name;

	repo.state.onDidChange(async () => {
		if (repo.state.HEAD?.name !== latestBranch) {
			if (latestBranch) {
				await updateGroup(Groups.branchGroupName(latestBranch));
			}
			await closeAllEditors();
			if (repo.state.HEAD?.name) {
				await restoreGroup(Groups.branchGroupName(repo.state.HEAD?.name));
			}
		}
		latestBranch = repo.state.HEAD?.name;
	});
}

async function updateGroup(group: string) {
	groups.remove(group);
	const openEditors = await getListOfEditors();
	groups.add(group, openEditors.filter(e => e));
}

function renameGroup(oldName: string, newName: string) {
	groups.rename(oldName, newName);
}

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
	groups.add(name, openEditors.filter(e => e));
	return true;
}

async function restoreGroup(groupName: string | undefined) {
	if (groupName === undefined) { return; }
	const group = groups.get(groupName);
	if (!group) { return; }
	group.list.forEach(editor => vscode.window.showTextDocument(editor.document, {
		preview: false,
		viewColumn: editor.viewColumn
	}));
}

async function closeAllEditors(): Promise<void> {
	const editorTracker = new ActiveEditorTracker();
	await editorTracker.awaitCloseAll();
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

	let ret = [];
	for (let index = 0; index < openEditors.length; index++) {
		const element = openEditors[index];
		if (element) { ret.push(element); }
	}
	ret = ret.sort((a, b) => parseInt(a.viewColumn?.toString() ?? '0') - parseInt(b.viewColumn?.toString() ?? '0'));
	return ret;
}
