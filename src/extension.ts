import * as path from 'path';
import { commands, Disposable, ExtensionContext, extensions, TextEditor, Uri, window, workspace } from 'vscode';
import { ActiveEditorTracker } from './activeEditorTracker';
import { TextDocumentComparer, TextEditorComparer } from './comparers';
import { BuiltInCommands, GitBranchGroups } from './constants';
import { Editor, Groups, GroupTreeItem, SplitTreeItem, TreeItem, TreeItemType } from './group';
import { API, GitExtension } from './typings/git';

const groups = new Groups();
let latestGroup: string;
let latestBranch: string | undefined;

export function activate(context: ExtensionContext) {

	const gitExtension = extensions.getExtension<GitExtension>('git')?.exports;
	const git = gitExtension?.getAPI(1);
	let gitBranchGroups = workspace.getConfiguration().get<GitBranchGroups>
		('tab-groups.gitBranchGroups', GitBranchGroups.SaveAndRestore);
	let repoOnDidChangeDisposable: Disposable | undefined;

	if (git?.state === 'initialized' && gitBranchGroups !== GitBranchGroups.Nothing) {
		repoOnDidChangeDisposable = initGitBranchGroups(git, gitBranchGroups);
	}

	git?.onDidChangeState(e => {
		if (e === 'initialized' && gitBranchGroups !== GitBranchGroups.Nothing) {
			repoOnDidChangeDisposable = initGitBranchGroups(git, gitBranchGroups);
		} else {
			repoOnDidChangeDisposable?.dispose();
		}
	});
	workspace.onDidChangeConfiguration(change => {
		if (change.affectsConfiguration('tab-groups.gitBranchGroups') && git) {
			gitBranchGroups = workspace.getConfiguration().get<GitBranchGroups>
				('tab-groups.gitBranchGroups', GitBranchGroups.SaveAndRestore);
			if (gitBranchGroups !== GitBranchGroups.Nothing) {
				repoOnDidChangeDisposable = initGitBranchGroups(git, gitBranchGroups);
			} else {
				repoOnDidChangeDisposable?.dispose();
			}
		}
	});
	window.registerTreeDataProvider('tab-groups-groups', groups);

	const disposables = [
		commands.registerCommand('extension.saveGroup', saveGroup),
		commands.registerCommand('extension.clearAndSaveGroup', async () => {
			const success = await saveGroup();
			if (!success) { return; }
			await closeAllEditors();
		}),
		commands.registerCommand('extension.updateGroup', async () => {
			const name = await window.showQuickPick(groups.listOfNames(), {
				canPickMany: false,
				placeHolder: 'Which tab group would you like to update?',
			});
			if (name === undefined) { return; }
			latestGroup = name;
			updateGroup(name);
		}),
		commands.registerCommand('extension.updateLastGroup', async () => {
			if (!latestGroup) {
				window.showWarningMessage('No last group');
				return;
			}
			updateGroup(latestGroup);
		}),
		commands.registerCommand('extension.saveGroupFromView', async (item: TreeItem) => {
			if (item === undefined) {
				return saveGroup();
			}

			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();

			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await updateGroup(groupName);
		}),
		commands.registerCommand('extension.restoreGroup', async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		commands.registerCommand('extension.restoreGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();

			const action: string = workspace.getConfiguration().get('tab-groups.sidebarRestoreStyle', 'Keep others');
			if (action.startsWith('Update current;') && groupName !== latestGroup) {
				await updateGroup(latestGroup);
			}
			if (action.endsWith('Close others')) {
				await closeAllEditors();
			}

			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		commands.registerCommand('extension.renameGroup', async (_item: TreeItem) => {
			const oldName = await window.showQuickPick(groups.listOfNames(), {
				canPickMany: false,
				placeHolder: 'Which tab group would you like to rename?',
			});
			if (oldName === undefined) { return; }

			let name = await window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return false; }
			name = name.trim();
			if (name === '') { name = groups.newGroupName(); }

			renameGroup(oldName, name);
		}),
		commands.registerCommand('extension.renameGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();

			if (groupName === undefined) { return; }
			latestGroup = groupName;

			let name = await window.showInputBox({
				placeHolder: 'Enter name for group or empty for default name'
			});
			if (name === undefined) { return false; }
			name = name.trim();
			if (name === '') { name = groups.newGroupName(); }

			renameGroup(groupName, name);
		}),
		commands.registerCommand('extension.clearAndRestoreGroup', async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await closeAllEditors();
			await restoreGroup(groupName);
		}),
		commands.registerCommand('extension.deleteGroup', async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
		commands.registerCommand('extension.closeAllEditors', () => {
			commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
		}),
		commands.registerCommand('extension.deleteGroupFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
		commands.registerCommand('extension.deleteEditorGroupFromView', async (item: TreeItem) => {
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
		commands.registerCommand('extension.openFileFromView', async (item: TreeItem) => {
			if (item.getType() !== TreeItemType.FILE) {
				return;
			}
			let group: Editor[] | undefined;

			let parent = item.getParent();
			if (parent?.getType() === TreeItemType.GROUP) {
				group = groups.get(parent.getData());
			} else {
				parent = parent?.getParent();
				if (parent?.getType() === TreeItemType.GROUP) {
					group = groups.get(parent.getData().name);
				}
			}

			if (!group) { return; }

			const editor = group.find(e => e.document.fileName === item.getData());
			if (!editor) { return; }

			try {
				const openRelative = workspace.getConfiguration().get<boolean>('tab-groups.relativePaths', false);
				let openRelativeSuccess = false;
				if (openRelative && editor.workspaceIndex !== undefined && editor.path && workspace.workspaceFolders) {
					const wsUri = workspace.workspaceFolders[editor.workspaceIndex].uri;
					try {
						await window.showTextDocument(Uri.parse(`${wsUri.scheme}://${wsUri.path}${path.sep}${editor.path}`), {
							preview: false,
							viewColumn: editor.viewColumn
						});
						openRelativeSuccess = true;
					} catch (error) {
						console.log(error);
					}
				}
				if (!openRelativeSuccess) {
					await window.showTextDocument(editor.document, {
						preview: false,
						viewColumn: editor.viewColumn
					});
				}
				if (editor.pinned) await commands.executeCommand('workbench.action.pinEditor');
			} catch (error) {
				console.error(error);
			}
		}),
		commands.registerCommand('extension.undo', () => groups.undo()),
		commands.registerCommand('extension.undoFromView', (_item: TreeItem) => groups.undo()),
		commands.registerCommand('extension.trackGroup', () => groups.track(latestGroup)),
		commands.registerCommand('extension.trackGroupFromView', () => groups.track(latestGroup)),
		commands.registerCommand('extension.stopTrackingGroup', () => stopTrackingGroup()),
		commands.registerCommand('extension.stopTrackingGroupFromView', () => stopTrackingGroup()),
	];
	context.subscriptions.concat(disposables);
}

export function deactivate() {
	stopTrackingGroup();
}

function initGitBranchGroups(git: API, option: GitBranchGroups) {
	if (git.repositories.length === 0) { return; }

	const repo = git.repositories[0];
	latestBranch = repo.state.HEAD?.name;

	if (option as any === true || option as any === false) {
		window.showErrorMessage('tab-groups.gitBranchGroups needs to be updated');
		return repo.state.onDidChange(() => { });
	}

	return repo.state.onDidChange(async () => {
		if (repo.state.HEAD?.name !== latestBranch) {
			if (latestBranch) {
				await updateGroup(Groups.branchGroupName(latestBranch), true);
			}
			if (option === GitBranchGroups.SaveAndRestore) {
				await closeAllEditors();
				if (repo.state.HEAD?.name) {
					await restoreGroup(Groups.branchGroupName(repo.state.HEAD?.name));
				}
			}
		}
		latestBranch = repo.state.HEAD?.name;
	});
}

async function stopTrackingGroup() {
	const update = groups.track('');
	if (update) await updateGroup(groups.tracking);
}

async function updateGroup(group: string, save = false) {
	if (group === undefined) { return; }
	if (groups.remove(group, true) || save) {
		const openEditors = await getListOfEditors();
		groups.add(group, openEditors.filter(e => e));
	}
}

function renameGroup(oldName: string, newName: string) {
	groups.rename(oldName, newName);
}

async function saveGroup(): Promise<boolean> {
	let name = await window.showInputBox({
		placeHolder: 'Enter name for group or empty for default name'
	});
	if (name === undefined) { return false; }
	name = name.trim();
	if (name === '') { name = groups.newGroupName(); }

	if (groups.listOfNames().includes(name)) {
		const overwrite = await window.showInputBox({
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
	await stopTrackingGroup();
	if (groupName === undefined) { return; }
	const group = groups.get(groupName);
	if (!group) { return; }
	const openRelative = workspace.getConfiguration().get<boolean>('tab-groups.relativePaths', false);
	for (const editor of group) {
		try {
			let openRelativeSuccess = false;
			if (openRelative && editor.workspaceIndex !== undefined && editor.path && workspace.workspaceFolders) {
				const wsUri = workspace.workspaceFolders[editor.workspaceIndex].uri;
				try {
					await window.showTextDocument(Uri.parse(`${wsUri.scheme}://${wsUri.path}${path.sep}${editor.path}`), {
						preview: false,
						viewColumn: editor.viewColumn
					});
					openRelativeSuccess = true;
				} catch (error) {
					console.log(error);
				}
			}
			if (!openRelativeSuccess) {
				await window.showTextDocument(editor.document, {
					preview: false,
					viewColumn: editor.viewColumn
				});
			}
			if (editor.pinned) await commands.executeCommand('workbench.action.pinEditor');
		} catch (error) {
			console.error(error);
		}
	}

	const focussed = group.find(editor => editor.focussed);
	if (focussed) {
		await focusEditor(focussed);
	}
}

async function closeAllEditors(): Promise<void> {
	await stopTrackingGroup();
	const editorTracker = new ActiveEditorTracker();
	await editorTracker.awaitCloseAll();
	editorTracker.dispose();
}

async function getListOfEditors(): Promise<Editor[]> {
	const editorTracker = new ActiveEditorTracker();

	const focussedEditor = window.activeTextEditor;
	await commands.executeCommand(BuiltInCommands.FocusFirstEditorGroup);
	await commands.executeCommand(BuiltInCommands.ViewFirstEditor);
	const active = window.activeTextEditor;
	let activeEditor = active;
	const openEditors: { editor: TextEditor, pinned: boolean }[] = [];
	do {
		if (activeEditor) {
			await editorTracker.close();
			await commands.executeCommand(BuiltInCommands.ViewFirstEditor);
			const pinned = TextEditorComparer.equals(activeEditor, window.activeTextEditor);
			openEditors.push({ editor: activeEditor as any, pinned });
			if (pinned) await editorTracker.closePinned();
		}

		await commands.executeCommand(BuiltInCommands.ViewFirstEditor);
		activeEditor = window.activeTextEditor;
		if (activeEditor === undefined) activeEditor = await editorTracker.awaitNext();
		if (activeEditor === undefined ||
			openEditors.some(_ => TextEditorComparer.equals(_.editor, activeEditor, { useId: true, usePosition: true }))) { break; }
	} while ((active === undefined && activeEditor === undefined) ||
		!TextEditorComparer.equals(active, activeEditor, { useId: true, usePosition: true }));
	editorTracker.dispose();

	for (const editor of openEditors) {
		try {
			await window.showTextDocument(editor.editor.document, {
				preview: false,
				viewColumn: editor.editor.viewColumn
			});
			if (editor.pinned) await commands.executeCommand('workbench.action.pinEditor');
		} catch (error) {
			console.error(error);
		}
	}

	let ret: Editor[] = [];
	for (const element of openEditors) {
		if (element) {
			const uri = element.editor.document.uri;
			ret.push({
				document: element.editor.document,
				workspaceIndex: workspace.getWorkspaceFolder(uri)?.index,
				path: workspace.asRelativePath(uri, false),
				viewColumn: element.editor.viewColumn,
				focussed: TextEditorComparer.equals(element.editor, focussedEditor),
				pinned: element.pinned,
			});
		}
	}

	// Sort by viewcolumn
	ret = ret.sort((a, b) => parseInt(a.viewColumn?.toString() ?? '0') - parseInt(b.viewColumn?.toString() ?? '0'));
	if (focussedEditor) {
		await focusEditor({
			document: focussedEditor.document,
			focussed: true,
			viewColumn: focussedEditor.viewColumn,
			pinned: false,
		});
	}
	return ret;
}

async function focusEditor(focussed: Editor) {
	const editorTracker = new ActiveEditorTracker();
	let active = window.activeTextEditor;
	let editor = active;
	const openEditors = [];
	do {
		if (editor !== null) {
			// If we didn't start with a valid editor, set one once we find it
			if (active === undefined) active = editor;
			if (active === undefined) break;

			openEditors.push(editor);
		}

		editor = await editorTracker.awaitNext(500);
		if (editor !== undefined &&
			openEditors.some(_ => TextEditorComparer.equals(_, editor, { useId: true, usePosition: true }))) { break; }
		if (TextDocumentComparer.equals(editor?.document, focussed.document) && editor?.viewColumn === focussed.viewColumn) {
			break;
		}
	} while ((active === undefined && editor === undefined) ||
		!TextEditorComparer.equals(active, editor, { useId: true, usePosition: true }));
	editorTracker.dispose();
}
