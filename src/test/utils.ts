import { TabGroups } from 'vscode';
import _ = require('lodash');

let groupCounter = 2;
export function newGroupName() {
    return `Group ${groupCounter++}\n`;
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
