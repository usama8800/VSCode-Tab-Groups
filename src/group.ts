import { cloneDeep, set, unset } from 'lodash';
import {
    EventEmitter, ExtensionContext, Memento, ProviderResult, Tab, TabGroup, TabGroups, TreeDataProvider,
    TreeItem, TreeItemCollapsibleState, ViewColumn, window, workspace
} from 'vscode';
import { Commands, Configurations, deserializeTabGroups, serializeTabGroups, tabToFilename } from './constants';
import _ = require('lodash');

type TreeItemData = TabGroups | TabGroup | Tab;

export enum TreeItemType {
    GROUP = 'group', SPLIT = 'split', FILE = 'file'
}

export class CustomTreeItem {
    protected type: TreeItemType;
    protected data: TreeItemData;
    protected name: string;
    protected tracking?: boolean;
    private parent?: CustomTreeItem;

    constructor(type: TreeItemType, data: TreeItemData, extra?: {
        name?: string, parent?: CustomTreeItem, tracking?: boolean
    }) {
        this.type = type;
        this.data = data;
        this.parent = extra?.parent;
        this.name = extra?.name ?? '';
        this.tracking = extra?.tracking;
    }

    getCollapsibleState() {
        return this.type === TreeItemType.GROUP ?
            TreeItemCollapsibleState.Collapsed :
            this.type === TreeItemType.SPLIT ?
                TreeItemCollapsibleState.Expanded :
                TreeItemCollapsibleState.None;
    }

    getText() {
        if (this.type === TreeItemType.FILE) { return tabToFilename(this.data as Tab); }
        return this.name;
    }

    getData() {
        return this.data;
    }

    getType() {
        return this.type;
    }

    getParent() {
        return this.parent;
    }

    toString() {
        return `${this.type}: ${this.name}`;
    }
}

export class GroupTreeItem extends CustomTreeItem {
    constructor(data: TreeItemData, name: string, tracking: boolean) {
        super(TreeItemType.GROUP, data, { name, tracking });
    }

    getText() {
        return this.tracking ? `${this.name} 📌` : this.name;
    }

    getName() {
        return this.name;
    }
}

export class SplitTreeItem extends CustomTreeItem {

    constructor(data: TreeItemData, name: string, parent: CustomTreeItem) {
        super(TreeItemType.SPLIT, data, { parent, name });
    }

    getText() {
        return `Split ${this.getViewColumn()}`;
    }

    getGroupName(): string {
        return this.name;
    }

    getViewColumn(): ViewColumn {
        return (this.data as TabGroup).viewColumn;
    }

    toString() {
        return `${this.type}: ${this.getViewColumn()}`;
    }
}

export class Groups implements TreeDataProvider<CustomTreeItem>{
    groups: { [key: string]: TabGroups };
    undoStack: { [key: string]: TabGroups }[];
    private _tracking = '';
    private globalState: Memento;
    private workspaceState: Memento;

    constructor(context: ExtensionContext) {
        this.globalState = context.globalState;
        this.workspaceState = context.workspaceState;
        const global = workspace.getConfiguration().get(Configurations.SaveGlobally, false);
        let base64 = '';
        if (global) {
            base64 = this.globalState.get('tab-groups') ?? base64;
        } else {
            base64 = this.workspaceState.get('tab-groups') ?? base64;
        }

        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        this.groups = {};
        this.undoStack = [];
        if (decoded === '') {
            console.log('No saved groups');
            return;
        }

        try { // Try to use the decoded base64
            const parsed = JSON.parse(decoded);
            if (parsed instanceof Array && parsed.length > 0) {
                for (const { name, tabGroups, activeTabGroup } of parsed) {
                    this.groups[name] = deserializeTabGroups(tabGroups, activeTabGroup);
                }
            }
        } catch (err) {
            console.error(err);
            console.log('Was not able to parse decoded Base64 as Json');
        } // Base64 decoded was not valid
    }

    private _onDidChangeTreeData = new EventEmitter<CustomTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: CustomTreeItem): TreeItem | Thenable<TreeItem> {
        const item = new TreeItem(
            (element.getType() === TreeItemType.SPLIT ? element as SplitTreeItem : element).getText(),
            element.getCollapsibleState(),
        );
        item.contextValue = element.getType();
        if (element.getType() === TreeItemType.FILE) {
            item.tooltip = element.getText();
            item.command = {
                command: Commands.OpenFileFromView,
                title: 'Open file',
                arguments: [element]
            };
        } else if (element.getType() === TreeItemType.GROUP) {
            item.command = {
                command: Commands.RestoreFromView,
                title: 'Restore group',
                arguments: [element]
            };
        }
        return item;
    }

    getParent(element: CustomTreeItem): ProviderResult<CustomTreeItem> {
        return element.getParent();
    }

    getChildren(element?: CustomTreeItem): ProviderResult<CustomTreeItem[]> {
        if (element === undefined) {
            return Object.keys(this.groups).sort((a, b) => a.localeCompare(b)).map(
                name => new GroupTreeItem(this.groups[name], name, this._tracking === name));
        }

        if (element.getType() === TreeItemType.GROUP) {
            const name = (element as GroupTreeItem).getName();
            const group = this.groups[name];
            return group.all.reduce((prev, curr) => {
                if (prev.find(item =>
                    item.getType() === TreeItemType.SPLIT &&
                    (item as SplitTreeItem).getViewColumn() === curr.viewColumn) === undefined) {
                    prev.push(new SplitTreeItem(curr, name, element));
                }
                return prev;
            }, [] as CustomTreeItem[]);
        }

        if (element.getType() === TreeItemType.SPLIT) {
            const e = element as SplitTreeItem;
            const group = e.getData() as TabGroup;
            return group.tabs.map(file => new CustomTreeItem(TreeItemType.FILE, file, { parent: e }));
        }
    }

    static branchGroupName(root: string, branch: string) {
        return `${root}: ${branch}`;
    }

    get tracking(): string {
        return this._tracking;
    }


    track(v: string) {
        const currentGroup = this.groups[this._tracking];
        this._tracking = v;
        this._onDidChangeTreeData.fire(undefined);
        if (!v) return currentGroup;
        return undefined;
    }

    add(name: string, list: TabGroups) {
        this.undoStack.push(cloneDeep(this.groups));
        this.groups[name] = cloneDeep(list);
        this.save();
    }

    remove(name: string, updating = false) {
        if (this.groups[name] === undefined) return false;
        if (!updating) this.undoStack.push(cloneDeep(this.groups));
        unset(this.groups, name);
        this.save();
        return true;
    }

    rename(oldName: string, newName: string) {
        this.undoStack.push(cloneDeep(this.groups));
        set(this.groups, newName, this.groups[oldName]);
        unset(this.groups, oldName);
        this.save();
    }

    removeFile(fileItem: CustomTreeItem) {
        const split = fileItem.getParent() as SplitTreeItem;
        const group = split?.getParent() as GroupTreeItem;
        const groupName = group?.getText();
        if (!groupName || !split || !group) return;
        const tabGroups = this.groups[groupName];
        if (!tabGroups) return;

        const serialized = serializeTabGroups(tabGroups, { tabs: [fileItem.getData() as Tab] });
        this.undoStack.push(cloneDeep(this.groups));
        this.groups[groupName] = deserializeTabGroups(serialized, tabGroups.activeTabGroup.viewColumn);
        this.save();
    }

    undo() {
        const groups = this.undoStack.pop();
        if (groups) {
            this.groups = groups;
            this.save();
        } else {
            window.showInformationMessage('Nothing to undo');
        }
    }

    removeViewColumn(name: string, viewColumn: ViewColumn) {
        const tabGroups = this.groups[name];
        if (!tabGroups) { return; }

        const serialized = serializeTabGroups(tabGroups, { viewColumns: [viewColumn] });
        this.undoStack.push(cloneDeep(this.groups));
        this.groups[name] = deserializeTabGroups(serialized, tabGroups.activeTabGroup.viewColumn);
        this.save();
    }

    get(name: string) {
        return this.groups[name];
    }

    listOfNames(): string[] {
        return Object.keys(this.groups);
    }

    length(): number {
        return Object.keys(this.groups).length;
    }

    newGroupName(): string {
        return `Group ${this.length() + 1}`;
    }

    private save() {
        const global = workspace.getConfiguration().get(Configurations.SaveGlobally, false);
        const encoded = Buffer.from(this.serialize()).toString('base64');
        if (global) {
            this.globalState.update('tab-groups', encoded);
        } else {
            this.workspaceState.update('tab-groups', encoded);
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    private serialize() {
        const serialized = [];
        for (const name in this.groups) {
            const tabGroups = this.groups[name];
            let activeTabGroup;
            for (let i = 0; i < tabGroups.all.length; i++) {
                const tabGroup = tabGroups.all[i];
                if (tabGroup.isActive) {
                    activeTabGroup = i;
                }
            }
            // TabGroups
            serialized.push({
                name, activeTabGroup,
                tabGroups: serializeTabGroups(tabGroups),
            });
        }
        return JSON.stringify(serialized);
    }
}
