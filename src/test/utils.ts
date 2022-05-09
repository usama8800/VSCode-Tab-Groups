import { TabGroups } from 'vscode';
import _ = require('lodash');

export type Editor = { file: string, viewColumn: number };

let groupCounter = 1;
export function newGroupName() {
    return `Group${groupCounter++}\n`;
}

export function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

export function checkTabGroups(tabGroups1: TabGroups, tabGroups2: TabGroups) {
    if (tabGroups1.activeTabGroup !== tabGroups2.activeTabGroup)
        return 'Active tab group is not the same';
    if (tabGroups1.all.length !== tabGroups2.all.length)
        return 'Number of tab groups is not the same';
    for (let i = 0; i < tabGroups1.all.length; i++) {
        const tabGroup1 = tabGroups1.all[i];
        const tabGroup2 = tabGroups2.all[i];
        if (tabGroup1.activeTab !== tabGroup2.activeTab)
            return `Active tab is not the same in tab group ${i}`;
        if (tabGroup1.tabs.length !== tabGroup2.tabs.length)
            return `Number of tabs is not the same in tab group ${i}`;
        if (tabGroup1.viewColumn !== tabGroup2.viewColumn)
            return `View column is not the same in tab group ${i}`;
        for (let j = 0; j < tabGroup1.tabs.length; j++) {
            const tab1 = tabGroup1.tabs[j];
            const tab2 = tabGroup2.tabs[j];
            if (tab1.isPinned !== tab2.isPinned)
                return `Is pinned is not the same in tab group ${i}`;
            if (tab1.isPreview !== tab2.isPreview)
                return `Is preview is not the same in tab group ${i}`;
            if (tab1.label !== tab2.label)
                return `Label is not the same in tab group ${i}`;
        }
    }
}

export function reprEditors(editors: Editor): string;
export function reprEditors(editors: Editor[]): string[];
export function reprEditors(es: any): any {
    const editors = es as Editor | Editor[];
    console.log(editorToViewColumns(editors as any));
    const f = (e: Editor) => `${e.file}(${e.viewColumn})`;
    if (editors instanceof Array) {
        return editors.sort((a, b) => (a.viewColumn ?? 0) - (b.viewColumn ?? 0)).map(f);
    } else {
        return f(editors);
    }
}

export function editorToFilenames(editors: Editor): string;
export function editorToFilenames(editors: Editor[]): string[];
export function editorToFilenames(es: any): any {
    const editors = es as Editor | Editor[];
    if (editors instanceof Array) {
        return editors.map(e => e.file).sort();
    } else {
        return editors.file;
    }
}

export function editorToViewColumns(editors: Editor): number;
export function editorToViewColumns(editors: Editor[]): number[];
export function editorToViewColumns(es: any): any {
    const editors = es as Editor | Editor[];
    if (editors instanceof Array) {
        return editors.map(e => e.viewColumn).sort();
    } else {
        return editors.viewColumn;
    }
}
