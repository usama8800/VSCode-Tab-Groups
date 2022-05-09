
import { commands, Disposable, TextEditor, window } from 'vscode';
import { BuiltInCommands } from './constants';

export class ActiveEditorTracker extends Disposable {

    private _disposable: Disposable;
    private _resolver: any;

    constructor() {
        super(() => this.dispose());

        this._disposable = window.onDidChangeActiveTextEditor(e => this._resolver && this._resolver(e));
    }

    dispose() {
        // tslint:disable-next-line: no-unused-expression
        this._disposable && this._disposable.dispose();
    }

    async awaitCloseAll(): Promise<void> {
        await this.closeAll();
        return await new Promise(resolve => setTimeout(() => {
            resolve();
        }, 100));
    }

    async reopen(): Promise<void> {
        return commands.executeCommand(BuiltInCommands.ReopenClosedEditor);
    }

    async awaitNext(timeout = 300): Promise<TextEditor | undefined> {
        this.next();
        return this.wait(timeout);
    }

    async close(): Promise<void> {
        return commands.executeCommand(BuiltInCommands.CloseActiveEditor);
    }

    async closePinned(): Promise<void> {
        return commands.executeCommand(BuiltInCommands.CloseActivePinnedEditor);
    }

    async closeAll(): Promise<unknown | undefined> {
        return commands.executeCommand(BuiltInCommands.CloseAllEditorGroups);
    }

    async next(): Promise<unknown | undefined> {
        return commands.executeCommand(BuiltInCommands.NextEditor);
    }

    async wait(timeout = 300): Promise<TextEditor | undefined> {
        const editor = await new Promise<TextEditor | undefined>(resolve => {
            let timer: any;

            this._resolver = (eeditor: TextEditor) => {
                if (timer) {
                    clearTimeout(timer as any);
                    timer = 0;
                    resolve(eeditor);
                }
            };

            timer = setTimeout(() => {
                resolve(window.activeTextEditor);
                timer = 0;
            }, timeout) as any;
        });
        this._resolver = undefined;
        return editor;
    }
}
