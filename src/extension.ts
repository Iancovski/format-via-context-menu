import * as vscode from 'vscode';
import Formatter from './formatter';

export function activate(context: vscode.ExtensionContext) {
    let format = vscode.commands.registerCommand('extension.format', async (uri: vscode.Uri, selectedUris: vscode.Uri[]) => {
        await Formatter.format(selectedUris.length ? selectedUris : [uri]);
    });

    context.subscriptions.push(format);
}

export function deactivate() { }
