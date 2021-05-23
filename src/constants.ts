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
    Groups: 'tab-groups.groups',
};

export enum GitBranchGroups {
    SaveAndRestore = 'Save and Restore',
    SaveOnly = 'Save only',
    Nothing = 'Nothing',
}
