import { cloneDeep, set, unset } from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import _ = require('lodash');

export interface Editor {
    document: vscode.TextDocument;
    viewColumn?: vscode.ViewColumn;
    focussed: boolean;
    pinned: boolean;
}

export enum TreeItemType {
    GROUP = 'group', SPLIT = 'split', FILE = 'file'
}

export class TreeItem {
    protected type: TreeItemType;
    protected data: any;
    private parent?: TreeItem;

    constructor(type: TreeItemType, data: any, parent?: TreeItem) {
        this.type = type;
        this.data = data;
        this.parent = parent;
    }

    getCollapsibleState() {
        return this.type === TreeItemType.GROUP ?
            vscode.TreeItemCollapsibleState.Collapsed :
            this.type === TreeItemType.SPLIT ?
                vscode.TreeItemCollapsibleState.Expanded :
                vscode.TreeItemCollapsibleState.None;
    }

    getText() {
        if (this.type === TreeItemType.FILE) { return path.basename(this.data); }
        return this.data;
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
        return `${this.type}: ${this.data}`;
    }
}

export class GroupTreeItem extends TreeItem {
    constructor(name: string, tracking: boolean) {
        super(TreeItemType.GROUP, {
            name, tracking
        });
    }

    getText() {
        return this.data.tracking ? `${this.data.name} 📌` : this.data.name;
    }

    getName() {
        return this.data.name;
    }
}

export class SplitTreeItem extends TreeItem {

    constructor(groupName: string, parent: TreeItem, viewColumn?: vscode.ViewColumn) {
        super(TreeItemType.SPLIT, {
            groupName,
            viewColumn,
        }, parent);
    }

    getText() {
        return `Split ${this.data.viewColumn}`;
    }

    getGroupName(): string {
        return this.data.groupName;
    }

    getViewColumn(): vscode.ViewColumn {
        return this.data.viewColumn;
    }

    toString() {
        return `${this.type}: ${this.data.viewColumn}`;
    }
}

export class Groups implements vscode.TreeDataProvider<TreeItem>{
    groups: { [key: string]: Editor[] };
    undoStack: { [key: string]: Editor[] }[];
    private _tracking = '';

    constructor() {
        const base64 = vscode.workspace.getConfiguration().get('tab-groups.groups', '');
        const decoded = Buffer.from(base64, 'base64').toString('ascii');
        this.groups = {};
        this.undoStack = [];
        this.groups = JSON.parse(decoded);
        if (this.groups instanceof Array) {
            const tempGroups: any = {};
            for (const { name, list } of this.groups) {
                tempGroups[name] = list;
            }
            this.groups = tempGroups;
        }
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const item = new vscode.TreeItem(
            (element.getType() === TreeItemType.SPLIT ? element as SplitTreeItem : element).getText(),
            element.getCollapsibleState(),
        );
        item.contextValue = element.getType();
        if (element.getType() === TreeItemType.FILE) {
            item.tooltip = element.getData();
            item.command = {
                command: 'extension.openFileFromView',
                title: 'Open file',
                arguments: [element]
            };
        } else if (element.getType() === TreeItemType.GROUP) {
            item.command = {
                command: 'extension.restoreGroupFromView',
                title: 'Restore group',
                arguments: [element]
            };
        }
        return item;
    }

    getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
        return element.getParent();
    }

    getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return Object.keys(this.groups).sort((a, b) => a.localeCompare(b)).map(
                name => new GroupTreeItem(name, this._tracking === name));
        }

        if (element.getType() === TreeItemType.GROUP) {
            const name = (element as GroupTreeItem).getName();
            const group = this.groups[name];
            if (group === undefined) { return []; }

            return group.reduce((prev, curr) => {
                if (prev.find(item =>
                    item.getType() === TreeItemType.SPLIT &&
                    (item as SplitTreeItem).getViewColumn() === curr.viewColumn) === undefined) {
                    prev.push(new SplitTreeItem(name, element, curr.viewColumn));
                }
                return prev;
            },
                [] as TreeItem[]);
        }

        if (element.getType() === TreeItemType.SPLIT) {
            const e = element as SplitTreeItem;
            const group = this.groups[e.getGroupName()];
            if (group === undefined) { return []; }

            return group.filter(editor => editor.viewColumn === e.getViewColumn()).map(editor => new TreeItem(TreeItemType.FILE,
                editor.document.fileName,
                element
            ));
        }
    }

    static branchGroupName(branch: string) {
        return `Branch: ${branch}`;
    }

    get tracking(): string {
        return this._tracking;
    }


    track(v: string) {
        const currentGroup = this.groups[this._tracking];
        this._tracking = v;
        this._onDidChangeTreeData.fire();
        if (!v) return currentGroup;
        return undefined;
    }

    add(name: string, list: Editor[]) {
        this.undoStack.push(cloneDeep(this.groups));
        this.groups[name] = list;
        this.saveToSettings();
    }

    remove(name: string, updating = false) {
        if (this.groups[name] === undefined) return false;
        if (!updating) this.undoStack.push(cloneDeep(this.groups));
        unset(this.groups, name);
        this.saveToSettings();
        return true;
    }

    rename(oldName: string, newName: string) {
        this.undoStack.push(cloneDeep(this.groups));
        set(this.groups, newName, this.groups[oldName]);
        unset(this.groups, oldName);
        this.saveToSettings();
    }

    removeFile(name: string, fileItem: TreeItem) {
        const group = this.groups[name];
        if (!group) { return; }

        this.undoStack.push(cloneDeep(this.groups));
        this.groups[name] = group.filter(editor => !(
            editor.document.fileName === fileItem.getData() &&
            editor.viewColumn === (fileItem.getParent() as SplitTreeItem).getViewColumn()
        ));
        this.saveToSettings();
    }

    undo() {
        const groups = this.undoStack.pop();
        if (groups !== undefined) {
            this.groups = groups;
            this.saveToSettings();
        } else {
            vscode.window.showInformationMessage('Nothing to undo');
        }
    }

    removeViewColumn(name: string, viewColumn?: vscode.ViewColumn) {
        const group = this.groups[name];
        if (!group) { return; }

        this.groups[name] = group.filter(editor => editor.viewColumn !== viewColumn);
        this.saveToSettings();
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

    private saveToSettings() {
        const global = vscode.workspace.getConfiguration().get('tab-groups.saveGlobally', false);
        const encoded = Buffer.from(JSON.stringify(this.groups)).toString('base64');
        vscode.workspace.getConfiguration().update('tab-groups.groups', encoded, global);
        this._onDidChangeTreeData.fire();
    }
}
