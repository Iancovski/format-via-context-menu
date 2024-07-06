import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const progressOptions: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: 'Formatting files',
    cancellable: true,
};

const acceptedExt: string = 'clj,coffee,jsonc,json,c,cpp,cu,cs,css,dart,go,groovy,' +
    'hbs,hlsl,html,java,jsx,js,mjs,cjs,jsonl,jl,md,markdown,tex,bib,less,lua,m,mm,' +
    'pl,raku,php,ps1,py,r,rb,rs,scss,sh,sql,swift,ts,tsx,vb,xml,xsl,yaml,yml'

export default class Formatter {
    static activeLanguages: string[] = [];

    public static async format(uris: vscode.Uri[]) {
        let filesUris: vscode.Uri[] = [];

        for (const uri of uris) {
            let isDirectory: boolean = (await fs.lstat(uri.fsPath)).isDirectory();

            if (isDirectory) {
                if (uri.fsPath.includes('node_modules')) {
                    return;
                }

                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(uri, `**/*.{${acceptedExt}}`),
                    '**/node_modules/**'
                );

                for (const file of files) {
                    filesUris.push(file);
                }
            } else {
                filesUris.push(uri);
            }
        }

        await Formatter.formatFiles(filesUris);
    }

    private static async formatFiles(uris: vscode.Uri[]) {
        let i: number = 1;
        let length: number = uris.length;
        const increment = (1 / length) * 100;

        if (length) {
            await vscode.window.withProgress(progressOptions,
                async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
                    for (const uri of uris) {
                        if (token.isCancellationRequested) {
                            break;
                        }

                        progress.report({ message: `${i}/${length}` });
                        await Formatter.formatFile(uri);
                        progress.report({ increment: increment });

                        i++;
                    };
                }
            );
        }
    }

    private static async formatFile(uri: vscode.Uri) {
        try {
            let closeAfterSave: boolean = false;
            let document: vscode.TextDocument = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);

            if (!document) {
                document = await vscode.workspace.openTextDocument(uri.fsPath);
                closeAfterSave = true;
            }

            await vscode.window.showTextDocument(document);
            await vscode.commands.executeCommand('editor.action.formatDocument');
            await document.save();

            if (closeAfterSave) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error formatting file ${uri.fsPath}: ${error.message}`);
        }
    }
}