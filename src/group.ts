import * as vscode from 'vscode';

interface Group {
    name: string;
    list: vscode.TextDocument[];
}

export class Groups {
    groups: Group[];

    constructor() {
        this.groups = vscode.workspace.getConfiguration().get('tab-groups.groups') || [];
    }

    add(name: string, list: vscode.TextDocument[]) {
        this.groups.push({ name, list });
        vscode.workspace.getConfiguration().update('tab-groups.groups', this.groups, false);
    }

    remove(name: string) {
        this.groups = this.groups.filter(g => g.name !== name);
        vscode.workspace.getConfiguration().update('tab-groups.groups', this.groups, false);
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
