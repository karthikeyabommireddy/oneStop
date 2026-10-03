// Stack detection and command resolution on synthetic repositories.

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStack, resolveCommands } from '../lib/stack.mjs';
import { makeRepo, removeRepo } from './helpers.mjs';

const rootOf = (det) => det.components.find((c) => c.path === '.') || det.components[0];

function withRepo(files, fn) {
  const dir = makeRepo(files);
  try { return fn(dir); } finally { removeRepo(dir); }
}

test('android kotlin: kotlin only, espresso bound, no ambiguity question', () => withRepo({
  'settings.gradle.kts': 'rootProject.name = "app"\n',
  'build.gradle.kts': 'plugins { id("com.android.application") version "8.5.0" apply false }\n',
  'src/Main.kt': 'fun main() {}', 'src/Screen.kt': 'class Screen', 'src/Model.kt': 'data class M(val a: Int)',
}, (dir) => {
  const c = rootOf(detectStack(dir));
  assert.equal(c.primary, 'kotlin');
  assert.ok(!c.stacks.some((s) => s.id === 'java'));
  assert.equal(c.app_automation, 'espresso');
  assert.equal(c.ambiguous_between, undefined);
}));

test('kotlin backend: no mobile automation', () => withRepo({
  'settings.gradle.kts': 'rootProject.name = "api"\n',
  'build.gradle.kts': 'plugins { kotlin("jvm") version "2.0.0" }\n',
  'src/Application.kt': 'fun main() {}', 'src/Routes.kt': 'fun routes() {}',
}, (dir) => {
  const c = rootOf(detectStack(dir));
  assert.equal(c.primary, 'kotlin');
  assert.equal(c.app_automation, null);
}));

test('java with Gradle Kotlin DSL: build scripts are not Kotlin source', () => withRepo({
  'settings.gradle.kts': 'rootProject.name = "svc"\n',
  'build.gradle.kts': 'plugins { java }\n',
  'src/main/java/App.java': 'class App {}', 'src/main/java/Svc.java': 'class Svc {}', 'src/main/java/Repo.java': 'class Repo {}',
}, (dir) => {
  const c = rootOf(detectStack(dir));
  assert.equal(c.primary, 'java');
  assert.ok(!c.stacks.some((s) => s.id === 'kotlin'));
}));

test('WPF binds FlaUI; an ASP.NET API binds no desktop automation', () => {
  withRepo({
    'Desk.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><UseWPF>true</UseWPF></PropertyGroup></Project>',
    'MainWindow.xaml.cs': 'class MainWindow {}',
  }, (dir) => assert.equal(rootOf(detectStack(dir)).app_automation, 'flaui'));
  withRepo({
    'Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="coverlet.collector" Version="6.0.0" /></ItemGroup></Project>',
    'Program.cs': 'var app = 1;',
  }, (dir) => {
    const det = detectStack(dir);
    assert.equal(rootOf(det).app_automation, null);
    const { commands } = resolveCommands(dir, { detection: det });
    assert.equal(commands.test.cmd, 'dotnet test');
    assert.match(commands.coverage.cmd, /XPlat/);
    assert.equal(commands.format.cmd, 'dotnet format --verify-no-changes');
  });
});

test('an existing FlaUI suite is detected from the project file', () => withRepo({
  'Desk.Tests.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="FlaUI.UIA3" Version="5.0.0" /></ItemGroup></Project>',
  'Tests.cs': 'class Tests {}',
}, (dir) => {
  assert.ok(detectStack(dir).existing_automation.some((e) => e.framework === 'flaui'));
}));

test('go: toolchain commands resolve, no npm playwright', () => withRepo({
  'go.mod': 'module example.com/x\n\ngo 1.23\n', 'main.go': 'package main', 'internal/a.go': 'package internal',
}, (dir) => {
  const det = detectStack(dir);
  assert.equal(rootOf(det).web_automation, null);
  const { commands } = resolveCommands(dir, { detection: det });
  assert.equal(commands.build.cmd, 'go build ./...');
  assert.equal(commands.test.cmd, 'go test ./...');
  assert.equal(commands.lint.cmd, 'go vet ./...');
}));

test('python with uv: commands run in the virtualenv; missing tools are not resolved', () => withRepo({
  'pyproject.toml': '[project]\nname = "x"\n[dependency-groups]\ndev = ["pytest>=8", "pytest-cov", "ruff"]\n',
  'uv.lock': 'version = 1\n', 'src/x/__init__.py': '', 'src/x/core.py': 'def f(): pass',
}, (dir) => {
  const { commands } = resolveCommands(dir);
  assert.match(commands.test.cmd, /^uv run pytest/);
  assert.equal(commands.lint.cmd, 'uv run ruff check .');
  assert.equal(commands.typecheck, undefined);
}));

test('typescript with pnpm: defaults run through pnpm exec; any-of requirements', () => withRepo({
  'package.json': JSON.stringify({ name: 'x', devDependencies: { vitest: '2.0.0', typescript: '5.6.0', '@vitest/coverage-istanbul': '2.0.0' } }),
  'pnpm-lock.yaml': 'lockfileVersion: 9.0\n', 'src/a.ts': 'export const a = 1;', 'src/b.ts': 'export const b = 2;',
}, (dir) => {
  const { commands } = resolveCommands(dir);
  assert.equal(commands.test.cmd, 'pnpm exec vitest run');
  assert.equal(commands.coverage.cmd, 'pnpm exec vitest run --coverage');
  assert.equal(commands.lint, undefined);
}));

test('package.json scripts win over registry defaults', () => withRepo({
  'package.json': JSON.stringify({ name: 'x', scripts: { test: 'vitest run --reporter dot' }, devDependencies: { vitest: '2.0.0' } }),
  'package-lock.json': '{}', 'src/a.ts': 'export const a = 1;',
}, (dir) => {
  const { commands } = resolveCommands(dir);
  assert.equal(commands.test.cmd, 'npm test');
  assert.equal(commands.test.confidence, 'task-runner');
}));

test('onestop.yml: a declared stack replaces detection, declared commands win', () => withRepo({
  'onestop.yml': 'commands:\n  test: make check\nstack:\n  components:\n    - path: .\n      stacks: [rust]\n      web_automation: playwright\n',
  'go.mod': 'module x\n', 'main.go': 'package main',
}, (dir) => {
  const det = detectStack(dir);
  const c = rootOf(det);
  assert.equal(c.primary, 'rust');
  assert.equal(c.declared, true);
  assert.equal(c.web_automation, 'playwright');
  const { commands } = resolveCommands(dir, { detection: det });
  assert.deepEqual([commands.test.cmd, commands.test.source], ['make check', 'onestop.yml']);
}));

test('an empty folder is greenfield', () => withRepo({ 'README.md': '# new' }, (dir) => {
  assert.equal(detectStack(dir).greenfield, true);
}));
