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

export const Configurations = {
    CloseEmptyGroups: 'workbench.editor.closeEmptyGroups',
    GitBranchGroups: 'tab-groups.gitBranchGroups',
    SidebarRestoreStyle: 'tab-groups.sidebarRestoreStyle',
    RelativePaths: 'tab-groups.relativePaths',
};

export enum GitBranchGroups {
    SaveAndRestore = 'Save and Restore',
    SaveOnly = 'Save only',
    Nothing = 'Nothing',
}
