import * as path from 'path';
import * as vscode from 'vscode';

interface Editor {
    document: vscode.TextDocument;
    viewColumn?: vscode.ViewColumn;
}
interface Group {
    name: string;
    list: Editor[];
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

export class SplitTreeItem extends TreeItem {

    constructor(groupName: string, parent: TreeItem, viewColumn?: vscode.ViewColumn) {
        super(TreeItemType.SPLIT, {
            groupName,
            viewColumn,
        }, parent);
    }

    getText() {
        return `Group ${this.data.viewColumn}`;
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
    groups: Group[];

    constructor() {
        const base64 = vscode.workspace.getConfiguration().get('tab-groups.groups', '');
        const decoded = Buffer.from(base64, 'base64').toString('ascii');
        try { // Try to use the decoded base64
            this.groups = JSON.parse(decoded);
            if (this.groups.length > 0 && this.groups[0].list.length > 0) {
                const isWithoutViewColumn = (this.groups[0].list[0] as any).document === undefined;
                if (isWithoutViewColumn) {
                    this.groups = this.groups.map(group => ({
                        name: group.name,
                        list: group.list.map(list => ({ document: (list as any), viewColumn: undefined }))
                    }));
                }
            }
        } catch { // Base64 decoded was not valid
            try { // Try unDecoded base64. Maybe it's saved unencoded
                this.groups = JSON.parse(base64);
            } catch {
                this.groups = [];
            }
        }
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const item = new vscode.TreeItem(
            (element.getType() === TreeItemType.SPLIT ? element as SplitTreeItem : element).getText(),
            element.getCollapsibleState(),
        );
        item.tooltip = element.getData();
        item.contextValue = element.getType();
        return item;
    }

    getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
        return element.getParent();
    }

    getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.groups.map(group => new TreeItem(TreeItemType.GROUP, group.name));
        }

        if (element.getType() === TreeItemType.GROUP) {
            const group = this.groups.find(group => group.name === element.getText());
            if (group === undefined) { return []; }

            return group.list.reduce((prev, curr) => {
                if (
                    prev.find(item =>
                        item.getType() === TreeItemType.SPLIT && (item as SplitTreeItem).getViewColumn() ===
                        curr.viewColumn) === undefined) {
                    prev.push(new SplitTreeItem(group.name, element, curr.viewColumn));
                }
                return prev;
            },
                [] as TreeItem[]);
        }

        if (element.getType() === TreeItemType.SPLIT) {
            const e = element as SplitTreeItem;
            const group = this.groups.find(group => group.name === e.getGroupName());
            if (group === undefined) { return []; }

            return group.list.filter(editor => editor.viewColumn === e.getViewColumn()).map(editor => new TreeItem(TreeItemType.FILE,
                editor.document.fileName,
                element
            ));
        }
    }

    static branchGroupName(branch: string) {
        return `Branch: ${branch}`;
    }

    add(name: string, editors: vscode.TextEditor[]) {
        this.groups.push({
            name,
            list: editors.map(editor => ({
                document: editor.document,
                viewColumn: editor.viewColumn
            }))
        });
        this.saveToSettings();
    }

    remove(name: string) {
        this.groups = this.groups.filter(g => g.name !== name);
        this.saveToSettings();
    }

    rename(oldName: string, newName: string) {
        const old = this.groups.find(group => group.name === oldName);
        if (old === undefined) { return; }
        old.name = newName;
        this.saveToSettings();
    }

    removeFile(name: string, fileItem: TreeItem) {
        console.log(name);
        const group = this.groups.find(group => group.name === name);
        if (!group) { return; }

        console.log(group.list);
        group.list = group.list.filter(editor =>
            !(editor.document.fileName === fileItem.getData() &&
                editor.viewColumn === (fileItem.getParent() as SplitTreeItem).getViewColumn()));
        console.log(group.list);
        this.saveToSettings();
    }

    removeViewColumn(name: string, viewColumn?: vscode.ViewColumn) {
        console.log(name);
        const group = this.groups.find(group => group.name === name);
        if (!group) { return; }

        console.log(group.list);
        group.list = group.list.filter(editor => editor.viewColumn !== viewColumn);
        console.log(group.list);
        this.saveToSettings();
    }

    get(name: string) {
        return this.groups.find(g => g.name === name);
    }

    listOfNames(): string[] {
        return this.groups.map(g => g.name);
    }

    length(): number {
        return this.groups.length;
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
