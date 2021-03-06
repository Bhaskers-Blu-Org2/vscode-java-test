// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, extensions, RelativePattern } from 'vscode';
import { testCodeLensController, testFileWatcher } from '../../extension.bundle';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from "path";
import { Uris } from '../shared';

suite('Test File Watcher Tests', function() {

    const sandbox = sinon.createSandbox();

    suiteSetup(async function() {
        await extensions.getExtension('vscjava.vscode-java-test')!.activate();
    });

    test("Should correctly setup code lens provider", async function() {
        let spy: sinon.SinonSpy = sandbox.spy(testCodeLensController, 'registerCodeLensProvider');
        await testFileWatcher.registerListeners();
        const args: RelativePattern[] = spy.getCall(0).args[0];
        assert.ok(args.length === 2);
        assert.ok(path.relative(args[0].base, path.join(Uris.JUNIT4_TEST_PACKAGE, '..')));
        spy.restore();
    });

    teardown(async function() {
        await commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
