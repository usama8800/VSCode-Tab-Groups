import * as path from 'path';
import { commands, Disposable, ExtensionContext, extensions, TextEditor, Uri, window, workspace } from 'vscode';
import { ActiveEditorTracker } from './activeEditorTracker';
import { TextEditorComparer } from './comparers';
import { BuiltInCommands, Configurations, GitBranchGroups } from './constants';
import { Editor, Groups, GroupTreeItem, SplitTreeItem, TreeItem, TreeItemType } from './group';
import { API, GitExtension } from './typings/git';

const groups = new Groups();
let latestGroup: string;
let latestBranch: string | undefined;

export function activate(context: ExtensionContext) {

	const gitExtension = extensions.getExtension<GitExtension>('git')?.exports;
	const git = gitExtension?.getAPI(1);
	let gitBranchGroups = workspace.getConfiguration().get<GitBranchGroups>
		(Configurations.GitBranchGroups, GitBranchGroups.SaveAndRestore);
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
		if (change.affectsConfiguration(Configurations.GitBranchGroups) && git) {
			gitBranchGroups = workspace.getConfiguration().get<GitBranchGroups>
				(Configurations.GitBranchGroups, GitBranchGroups.SaveAndRestore);
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

			const action: string = workspace.getConfiguration().get(Configurations.SidebarRestoreStyle, 'Keep others');
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
				const openRelative = workspace.getConfiguration().get<boolean>(Configurations.RelativePaths, false);
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
	const openRelative = workspace.getConfiguration().get<boolean>(Configurations.RelativePaths, false);
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
			if (editor.pinned) await commands.executeCommand(BuiltInCommands.PinEditor);
		} catch (error) {
			console.error(error);
		}
	}

	const focussed = group.find(editor => editor.focussed);
	if (focussed) await window.showTextDocument(focussed.document, focussed.viewColumn);
}

async function closeAllEditors(): Promise<void> {
	await stopTrackingGroup();
	const editorTracker = new ActiveEditorTracker();
	await editorTracker.awaitCloseAll();
	editorTracker.dispose();
}

async function getListOfEditors(): Promise<Editor[]> {
	await workspace.getConfiguration().update(Configurations.CloseEmptyGroups, false, false);
	const focussed = window.activeTextEditor;
	const openEditors: { editor: TextEditor, pinned: boolean }[] = [];
	while (window.visibleTextEditors.length !== 0) {
		// Remove already saved editors
		const visibleEditors = window.visibleTextEditors.filter(e =>
			!openEditors.some(oe => TextEditorComparer.equals(e, oe.editor, { useId: false, usePosition: true })));
		// If all saved, only pinned remain with pinned = false
		if (visibleEditors.length === 0) {
			while (window.visibleTextEditors.length !== 0) {
				// Find pinned editor not closed in the for loop below
				const editor = openEditors.find(oe =>
					TextEditorComparer.equals(oe.editor, window.visibleTextEditors[0], { useId: false, usePosition: true }));
				if (editor) {
					editor.pinned = true;
					await window.showTextDocument(editor.editor.document, editor.editor.viewColumn);
					await commands.executeCommand(BuiltInCommands.CloseActivePinnedEditor);
				} else {
					window.showErrorMessage('There was a problem saving the pins on editors');
					break;
				}
			}
			break;
		}
		for (const editor of visibleEditors) {
			await window.showTextDocument(editor.document, editor.viewColumn);

			const closed = await commands.executeCommand(BuiltInCommands.CloseActiveEditor);
			// Not perfect. Doesn't return true if only pinned editor in group
			const pinned = closed === null;
			if (pinned) {
				await window.showTextDocument(editor.document, editor.viewColumn);
				await commands.executeCommand(BuiltInCommands.CloseActivePinnedEditor);
			}
			openEditors.push({ editor, pinned });
		}
	}
	for (const editor of openEditors) {
		await window.showTextDocument(editor.editor.document, { preview: false, viewColumn: editor.editor.viewColumn });
		if (editor.pinned) await commands.executeCommand(BuiltInCommands.PinEditor);
	}
	if (focussed) await window.showTextDocument(focussed.document, focussed.viewColumn);
	await workspace.getConfiguration().update(Configurations.CloseEmptyGroups, undefined, false);

	let ret: Editor[] = [];
	for (const element of openEditors) {
		if (element) {
			const uri = element.editor.document.uri;
			ret.push({
				document: element.editor.document,
				workspaceIndex: workspace.getWorkspaceFolder(uri)?.index,
				path: workspace.asRelativePath(uri, false),
				viewColumn: element.editor.viewColumn,
				focussed: TextEditorComparer.equals(element.editor, window.activeTextEditor, { useId: false, usePosition: true }),
				pinned: element.pinned,
			});
		}
	}

	// Sort by viewcolumn
	ret = ret.sort((a, b) => parseInt(a.viewColumn?.toString() ?? '0') - parseInt(b.viewColumn?.toString() ?? '0'));
	return ret;
}
