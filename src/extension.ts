import * as path from 'path';
import { commands, Disposable, ExtensionContext, extensions, Tab, TabInputText, Uri, window, workspace } from 'vscode';
import { BuiltInCommands, Commands, Configurations, GitBranchGroups } from './constants';
import { CustomTreeItem, Groups, GroupTreeItem, SplitTreeItem, TreeItemType } from './group';
import { API, GitExtension } from './typings/git';

let groups: Groups;
let latestGroup: string;
let latestBranch: string | undefined;

export function activate(context: ExtensionContext) {
	const gitExtension = extensions.getExtension<GitExtension>('vscode.git')?.exports;
	const git = gitExtension?.getAPI(1);
	let gitBranchGroups = workspace.getConfiguration().get<GitBranchGroups>
		(Configurations.GitBranchGroups, GitBranchGroups.SaveAndRestore);
	let repoOnDidChangeDisposable: Disposable | undefined;
	groups = new Groups(context);

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
		commands.registerCommand(Commands.Save, () => saveGroup()),
		commands.registerCommand(Commands.ClearAndSave, async () => {
			const success = await saveGroup();
			if (!success) { return; }
			await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
		}),
		commands.registerCommand(Commands.Update, async () => {
			const name = await window.showQuickPick(groups.listOfNames(), {
				canPickMany: false,
				placeHolder: 'Which tab group would you like to update?',
			});
			if (name === undefined) { return; }
			latestGroup = name;
			updateGroup(name);
		}),
		commands.registerCommand(Commands.UpdateLast, async () => {
			if (!latestGroup) {
				window.showWarningMessage('No last group');
				return;
			}
			updateGroup(latestGroup);
		}),
		commands.registerCommand(Commands.SaveFromView, async (item: CustomTreeItem) => {
			// If click save for new group
			if (item === undefined) return saveGroup();

			if (item.getType() !== TreeItemType.GROUP) return;
			const groupName = (item as GroupTreeItem).getName();

			if (groupName === undefined) return;
			latestGroup = groupName;
			await updateGroup(groupName);
		}),
		commands.registerCommand(Commands.Restore, async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		commands.registerCommand(Commands.ClearAndRestore, async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
			await restoreGroup(groupName);
		}),
		commands.registerCommand(Commands.RestoreFromView, async (item: CustomTreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();

			const action: string = workspace.getConfiguration().get(Configurations.SidebarRestoreStyle, 'Keep others');
			if (action.startsWith('Update current;') && groupName !== latestGroup) {
				await updateGroup(latestGroup);
			}
			if (action.endsWith('Close others')) {
				await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
			}

			if (groupName === undefined) { return; }
			latestGroup = groupName;
			await restoreGroup(groupName);
		}),
		commands.registerCommand(Commands.Rename, async (_item: CustomTreeItem) => {
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
		commands.registerCommand(Commands.RenameFromView, async (item: CustomTreeItem) => {
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
		commands.registerCommand(Commands.Delete, async () => {
			if (groups.length() === 0) {
				window.showInformationMessage('No saved groups');
				return;
			}
			const groupName = await window.showQuickPick(groups.listOfNames());
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
		commands.registerCommand(Commands.DeleteFromView, async (item: CustomTreeItem) => {
			if (item.getType() !== TreeItemType.GROUP) {
				return;
			}
			const groupName = (item as GroupTreeItem).getName();
			if (groupName === undefined) { return; }
			if (latestGroup === groupName) { latestGroup = ''; }
			groups.remove(groupName);
		}),
		commands.registerCommand(Commands.DeleteEditorGroupFromView, async (item: CustomTreeItem) => {
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

			if (isFile) { groups.removeFile(item); }
			else { groups.removeViewColumn(groupName, (item as SplitTreeItem).getViewColumn()); }
		}),
		commands.registerCommand(Commands.OpenFileFromView, async (item: CustomTreeItem) => {
			if (item.getType() !== TreeItemType.FILE) {
				return;
			}

			await openTab(item.getData() as Tab);
		}),
		commands.registerCommand(Commands.CloseAllEditors, () => {
			commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
		}),
		commands.registerCommand(Commands.Undo, () => groups.undo()),
		commands.registerCommand(Commands.UndoFromView, (_item: CustomTreeItem) => groups.undo()),
		commands.registerCommand(Commands.Track, () => groups.track(latestGroup)),
		commands.registerCommand(Commands.TrackFromView, () => groups.track(latestGroup)),
		commands.registerCommand(Commands.StopTracking, () => stopTrackingGroup()),
		commands.registerCommand(Commands.StopTrackingFromView, () => stopTrackingGroup()),
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

	return repo.state.onDidChange(async () => {
		if (repo.state.HEAD?.name !== latestBranch) {
			if (latestBranch) {
				await updateGroup(Groups.branchGroupName(latestBranch), true);
			}
			if (option === GitBranchGroups.SaveAndRestore) {
				await commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
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
		groups.add(group, window.tabGroups);
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
	groups.add(name, window.tabGroups);
	return true;
}

async function restoreGroup(groupName: string | undefined) {
	await stopTrackingGroup();

	if (groupName === undefined) { return; }
	const tabGroups = groups.get(groupName);
	if (!tabGroups) { return; }

	for (let i = 0; i < tabGroups.all.length; i++) {
		for (const tab of tabGroups.all[i].tabs) {
			await openTab(tab);
		}
	}

	for (const tabGroup of tabGroups.all) {
		await openTab(tabGroup.activeTab);
	}
	await openTab(tabGroups.activeTabGroup.activeTab);
}

async function openTab(tab?: Tab) {
	if (!tab) return;
	const input = tab.input as any;
	const uri: Uri = input.uri;
	const original: Uri = input.original;
	const modified: Uri = input.modified;
	const viewType = input.viewType;
	const notebookType = input.notebookType;

	// Normal
	if (uri && !viewType) return openNormalTab(tab);

	// Custom
	if (uri && viewType) return viewType + ': ' + path.basename(uri.path);

	// Webview
	if (!uri && viewType) return 'Webview: ' + viewType;

	// Diff
	if (!notebookType && modified && original) return path.basename(original.path) + ' diff ' + path.basename(modified.path);

	// Notebook Diff
	if (notebookType && modified && original)
		return notebookType + ': ' + path.basename(original.path) + ' diff ' + path.basename(modified.path);

	// Notebook
	if (notebookType) return notebookType + ': ' + path.basename(uri.path);

	// Terminal
	if (!uri && !original && !modified && !viewType && !notebookType) return 'Terminal: ' + tab.label;
}

async function openNormalTab(tab: Tab) {
	const openRelativeSuccess = false;
	const openRelative = workspace.getConfiguration().get<boolean>(Configurations.RelativePaths, false);
	const uri = Uri.file((tab.input as TabInputText).uri.path);
	if (openRelative && workspace.workspaceFolders) {
		for (let i = 0; i < workspace.workspaceFolders.length; i++) {
			const wsUri = workspace.workspaceFolders[i].uri;
			try {
				await window.showTextDocument(Uri.parse(`${wsUri.scheme}://${wsUri.path}${path.sep}${uri.path}`), {
					preview: false,
					viewColumn: tab.group.viewColumn,
				});
				break;
			} catch (error) {
				continue;
			}
		}
	}
	if (!openRelativeSuccess) {
		await window.showTextDocument(uri, {
			preview: false,
			viewColumn: tab.group.viewColumn,
		});
		if (tab.isPinned) await commands.executeCommand(BuiltInCommands.PinEditor);
	}
}
