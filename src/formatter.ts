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
        if (uri && uri.fsPath) {
            try {
                let document = await vscode.workspace.openTextDocument(uri.fsPath);

                const edits: vscode.TextEdit[] = await Formatter.getEdits(document);

                if (edits && edits.length) {
                    let formattedDocument = document.getText();
                    edits.sort((a, b) => b.range.start.compareTo(a.range.start));

                    for (const edit of edits) {
                        const start = document.offsetAt(edit.range.start);
                        const end = document.offsetAt(edit.range.end);
                        formattedDocument = formattedDocument.substring(0, start) + edit.newText + formattedDocument.substring(end);
                    }

                    await fs.writeFile(uri.fsPath, formattedDocument, 'utf8');
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error formatting file: ${error.message}`);
            }
        }
    }

    private static async getEdits(document: vscode.TextDocument) {
        let edits: vscode.TextEdit[];

        // TODO - Verify if file is opened in editor

        if (this.isLanguageActive(document.languageId)) {
            edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', document.uri, document.languageId);
        } else {
            /*
                The executeFormatDocumentProvider command may return undefined when executed right after 
                the openTextDocument because the format document provider might not have started yet. 
                Apparently VSCode doesn't have a method to await the format document provider's startup, 
                so a timeout should resolve this issue.
            */

            for (let i = 1; i <= 3; i++) {
                edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', document.uri, document.languageId);

                if (edits) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            Formatter.activeLanguages.push(document.languageId);
        }

        return edits;
    }

    private static isLanguageActive(language: string) {
        return Formatter.activeLanguages.includes(language);
    }
}