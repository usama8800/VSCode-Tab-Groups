import * as vscode from 'vscode';

interface Group {
    name: string;
    list: vscode.TextDocument[];
}

export class Groups {
    groups: Group[];

    constructor() {
        const base64 = vscode.workspace.getConfiguration().get('tab-groups.groups', '');
        const decoded = Buffer.from(base64, 'base64').toString('ascii');
        try { // Try to use the decoded base64
            this.groups = JSON.parse(decoded);
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

    add(name: string, list: vscode.TextDocument[]) {
        this.groups.push({ name, list });
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
