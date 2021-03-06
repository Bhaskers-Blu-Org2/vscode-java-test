// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CancellationToken, CodeLens, CodeLensProvider, Disposable, Event, EventEmitter, TextDocument } from 'vscode';
import { JavaTestRunnerCommands } from '../constants/commands';
import { logger } from '../logger/logger';
import { ITestItem, TestLevel } from '../protocols';
import { ITestResult, TestStatus } from '../runners/models';
import { testItemModel } from '../testItemModel';
import { testResultManager } from '../testResultManager';

export class TestCodeLensProvider implements CodeLensProvider, Disposable {
    private onDidChangeCodeLensesEmitter: EventEmitter<void> = new EventEmitter<void>();
    private isActivated: boolean = true;

    get onDidChangeCodeLenses(): Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public setIsActivated(isActivated: boolean): void {
        this.isActivated = isActivated;
        this.refresh();
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public async provideCodeLenses(document: TextDocument, _token: CancellationToken): Promise<CodeLens[]> {
        if (!this.isActivated) {
            return [];
        }

        try {
            const items: ITestItem[] = await testItemModel.getItemsForCodeLens(document.uri);
            return this.getCodeLenses(items);
        } catch (error) {
            logger.error('Failed to provide Code Lens', error);
            return [];
        }
    }

    public dispose(): void {
        this.onDidChangeCodeLensesEmitter.dispose();
    }

    private getCodeLenses(items: ITestItem[]): CodeLens[] {
        const codeLenses: CodeLens[] = [];
        for (const item of items) {
            codeLenses.push(
                new CodeLens(
                    item.location.range,
                    {
                        title: 'Run Test',
                        command: JavaTestRunnerCommands.RUN_TEST_FROM_CODELENS,
                        tooltip: 'Run Test',
                        arguments: [item],
                    },
                ),
                new CodeLens(
                    item.location.range,
                    {
                        title: 'Debug Test',
                        command: JavaTestRunnerCommands.DEBUG_TEST_FROM_CODELENS,
                        tooltip: 'Debug Test',
                        arguments: [item],
                    },
                ),
            );
            const resultCodeLens: CodeLens | undefined = this.getResultCodeLens(item);
            if (resultCodeLens) {
                codeLenses.push(resultCodeLens);
            }
        }
        return codeLenses;
    }

    private getResultCodeLens(item: ITestItem): CodeLens | undefined {
        if (item.level === TestLevel.Method) {
            const result: ITestResult | undefined = testResultManager.getResultById(item.id);
            if (result && result.status) {
                return new CodeLens(
                    item.location.range,
                    {
                        title: this.getResultIcon(result),
                        command: JavaTestRunnerCommands.SHOW_TEST_REPORT,
                        tooltip: 'Show Test Report',
                        arguments: [[result]],
                    },
                );
            }
        } else if (item.level === TestLevel.Class) {
            const childResults: Array<ITestResult | undefined> = [];
            this.getAllMethodResults(childResults, item);
            const title: string = this.getResultIcons(childResults);
            if (title) {
                return new CodeLens(
                    item.location.range,
                    {
                        title,
                        command: JavaTestRunnerCommands.SHOW_TEST_REPORT,
                        tooltip: 'Show Test Report',
                        arguments: [childResults],
                    },
                );
            }
        }
        return undefined;
    }

    private getAllMethodResults(childResults: Array<ITestResult | undefined>, item: ITestItem): void {
        if (!item.children) {
            return undefined;
        }
        for (const childId of item.children) {
            const child: ITestItem | undefined = testItemModel.getItemById(childId);
            if (!child) {
                continue;
            }
            if (child.level === TestLevel.Class) {
                this.getAllMethodResults(childResults, child);
            } else if (child.level === TestLevel.Method) {
                childResults.push(testResultManager.getResultById(childId));
            }
        }
    }

    private getResultIcon(result: ITestResult): string {
        switch (result.status) {
            case TestStatus.Pass:
                return '$(check)';
            case TestStatus.Fail:
                return '$(x)';
            default:
                return '';
        }
    }

    private getResultIcons(results: Array<ITestResult | undefined>): string {
        const passNum: number = results.filter((result: ITestResult | undefined) => result && result.status === TestStatus.Pass).length;
        const failNum: number = results.filter((result: ITestResult | undefined) => result && result.status === TestStatus.Fail).length;
        if (failNum > 0) {
            return '$(x)';
        } else if (passNum === 0) {
            return '';
        } else if (passNum === results.length) {
            return '$(check)';
        }

        return '?';
    }
}
