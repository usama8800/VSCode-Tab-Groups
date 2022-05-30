import * as path from 'path';
import { Tab, TabGroups } from 'vscode';

export const BuiltInCommands = {
    CloseActiveEditor: 'workbench.action.closeActiveEditor',
    CloseActivePinnedEditor: 'workbench.action.closeActivePinnedEditor',
    CloseAllEditorGroups: 'workbench.action.closeAllGroups',
    NextEditor: 'workbench.action.nextEditor',
    FocusFirstEditorGroup: 'workbench.action.focusFirstEditorGroup',
    ViewFirstEditor: 'workbench.action.firstEditorInGroup',
    ReopenClosedEditor: 'workbench.action.reopenClosedEditor',
    PinEditor: 'workbench.action.pinEditor',
};

export const Commands = {
    Save: 'extension.saveGroup',
    ClearAndSave: 'extension.clearAndSaveGroup',
    Update: 'extension.updateGroup',
    UpdateLast: 'extension.updateLastGroup',
    SaveFromView: 'extension.saveGroupFromView',
    Restore: 'extension.restoreGroup',
    ClearAndRestore: 'extension.clearAndrestoreGroup',
    RestoreFromView: 'extension.restoreGroupFromView',
    Rename: 'extension.renameGroup',
    RenameFromView: 'extension.renameGroupFromView',
    Delete: 'extension.deleteGroup',
    DeleteFromView: 'extension.deleteGroupFromView',
    DeleteEditorGroupFromView: 'extension.deleteEditorGroupFromView',
    OpenFileFromView: 'extension.openFileFromView',
    CloseAllEditors: 'extension.closeAllEditors',
    Undo: 'extension.undo',
    UndoFromView: 'extension.undoFromView',
    Track: 'extension.trackGroup',
    TrackFromView: 'extension.trackGroupFromView',
    StopTracking: 'extension.stopTrackingGroup',
    StopTrackingFromView: 'extension.stopTrackingGroupFromView',
};

export const Configurations = {
    CloseEmptyGroups: 'workbench.editor.closeEmptyGroups',
    GitBranchGroups: 'tab-groups.gitBranchGroups',
    SidebarRestoreStyle: 'tab-groups.sidebarRestoreStyle',
    RelativePaths: 'tab-groups.relativePaths',
    SaveGlobally: 'tab-groups.saveGlobally',
};

export enum GitBranchGroups {
    SaveAndRestore = 'Save and Restore',
    SaveOnly = 'Save only',
    Nothing = 'Nothing',
}

export function serializeTabGroups(tabGroups: TabGroups, ignores?: { tabs?: Tab[], viewColumns?: number[] }): string {
    const serializedTabGroups = [];
    for (let i = 0; i < tabGroups.all.length; i++) {
        const tabGroup = tabGroups.all[i];
        if (ignores?.viewColumns?.includes(tabGroup.viewColumn)) { continue; }
        let activeTab;
        const tabs = tabGroup.tabs;
        const serializedTabs = [];
        for (let j = 0; j < tabs.length; j++) {
            const tab = tabs[j];
            if (ignores?.tabs?.find(t => (t.input as any).uri.path === (tab.input as any).uri.path)) { continue; }
            serializedTabs.push({
                isActive: tab.isActive,
                isDirty: tab.isDirty,
                isPinned: tab.isPinned,
                isPreview: tab.isPreview,
                label: tab.label,
                input: tab.input,
                group: {
                    viewColumn: tab.group.viewColumn,
                }
            });
            if (tab.isActive) {
                activeTab = j;
            }
        }
        // TabGroup
        serializedTabGroups.push({
            activeTab,
            isActive: tabGroup.isActive,
            viewColumn: tabGroup.viewColumn,
            tabs: serializedTabs,
        });
    }
    return JSON.stringify(serializedTabGroups);
}

export function deserializeTabGroups(serializedTabGroups: string, activeTabGroup: number): TabGroups {
    const deserializedTabGroups = {
        all: [],
    } as any;
    const tabGroupsParsed = JSON.parse(serializedTabGroups);
    for (let i = 0; i < tabGroupsParsed.length; i++) {
        if (i === activeTabGroup)
            deserializedTabGroups.activeTabGroup = i;

        const tabGroup = tabGroupsParsed[i];
        const tabs = tabGroup.tabs;
        const deserializedTabGroup = {
            tabs: [],
            viewColumn: tabGroup.viewColumn,
            isActive: tabGroup.isActive,
        } as any;
        for (let j = 0; j < tabs.length; j++) {
            const tab = tabs[j];
            deserializedTabGroup.tabs.push(tab);
            if (j === tabGroup.activeTab) {
                deserializedTabGroup.activeTab = tab;
            }
        }
        deserializedTabGroups.all.push(deserializedTabGroup);
    }
    return deserializedTabGroups as TabGroups;
}

export function tabToFilename(tab: Tab): string {
    const input = tab.input as any;
    const uri = input.uri;
    const original = input.original;
    const modified = input.modified;
    const viewType = input.viewType;
    const notebookType = input.notebookType;

    // Normal
    if (uri && !viewType) return path.basename(uri.path);

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

    return 'Untitled';
}
