import * as vscode from 'vscode';

interface Editor {
    document: vscode.TextDocument;
    viewColumn?: vscode.ViewColumn;
}
interface Group {
    name: string;
    list: Editor[];
}

export class Groups {
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
        const global = vscode.workspace.getConfiguration().get('tab-groups.saveGlobally', false);
        const encoded = Buffer.from(JSON.stringify(this.groups)).toString('base64');
        vscode.workspace.getConfiguration().update('tab-groups.groups', encoded, global);
    }

    remove(name: string) {
        this.groups = this.groups.filter(g => g.name !== name);
        const global = vscode.workspace.getConfiguration().get('tab-groups.saveGlobally', false);
        const encoded = Buffer.from(JSON.stringify(this.groups)).toString('base64');
        vscode.workspace.getConfiguration().update('tab-groups.groups', encoded, global);
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
}
