export const BuiltInCommands = {
    CloseActiveEditor: 'workbench.action.closeActiveEditor',
    CloseActivePinnedEditor: 'workbench.action.closeActivePinnedEditor',
    CloseAllEditorGroups: 'workbench.action.closeAllGroups',
    NextEditor: 'workbench.action.nextEditor',
    FocusFirstEditorGroup: 'workbench.action.focusFirstEditorGroup',
    ViewFirstEditor: 'workbench.action.firstEditorInGroup',
    ReopenClosedEditor: 'workbench.action.reopenClosedEditor',
};

export enum GitBranchGroups {
    SaveAndRestore = 'Save and Restore',
    SaveOnly = 'Save only',
    Nothing = 'Nothing',
}
