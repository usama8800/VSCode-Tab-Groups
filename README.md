This is an extension for vscode. It allows you to save and restore groups of tabs manually and when changing git branches

# Usage

On the sidebar, you will see a Tab Group icon. It will list all the saved tab groups and provide buttons to save new tab groups, override existing ones, and restore tab groups. The context menu allows you to rename and delete tab groups. 

You can also execute these commands from the command pallette.

## Settings

- `tab-groups.saveGlobally` to change the location where the groups are saved (one list for all folders or lists per folder).
- `tab-groups.gitBranchGroups` to auto save and restore tab groups when changing git branches
- `tab-groups.sidebarRestoreStyle` to select what to do with the existing tabs when restoring a tab group from the sidebar


# Contributions

Thanks to [eamodio](https://github.com/eamodio) for the code to cycle through tabs
