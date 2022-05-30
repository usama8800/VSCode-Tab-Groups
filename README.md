This is an extension for vscode. It allows you to save and restore groups of tabs manually and when changing git branches

# Usage

On the sidebar, you will see a Tab Group icon. It will list all the saved tab groups. Clicking on the name of a tab group restores it. You can execute all commands from the command pallette.

The context menu on the group name allows you to rename and delete the group.

The branch settings allow for automatically swapping or just saving tab groups while switching branches.

The menu of the heading allows you to "track" the current group. The current group is decided by whichever group was last restored or saved. Current group is unset when starting vscode. Tracking just saves the group when you restore another group or close all editors using the sidebar. Closing vscode doesn't update the group.

## Settings

- `tab-groups.saveGlobally` to change the location where the groups are saved (one list for all folders or lists per folder).
- `tab-groups.gitBranchGroups` to auto save and restore tab groups when changing git branches
- `tab-groups.sidebarRestoreStyle` to select what to do with the existing tabs when restoring a tab group from the sidebar
