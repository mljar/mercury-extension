# mercury_app

[![Github Actions Status](https://github.com/mljar/mercury-extension/workflows/Build/badge.svg)](https://github.com/mljar/mercury-extension/actions/workflows/build.yml)

Run notebooks as web apps with Mercury inside JupyterLab.

This repository contains two parts:

- A standalone application to display a Jupyter notebook as Mercury dashboard on top of a Jupyter Server
- A JupyterLab extension to render a Jupyter notebook as Mercury dashboard; the extension is consumed by the application.

## Install

To install the extension, execute:

```bash
pip install mercury_app
```

## Usage

### Standalone application

You can open a notebook with the standalone application by executing:

```sh
python -m mercury_app <path/to/notebook.ipynb>
```

### JupyterLab extension

The new renderer should be available right away.

## Uninstall

To remove the extension, execute:

```bash
pip uninstall mercury_app
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the mercury_app directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

### Code structure

- `app` folder: `mercury-app` NPM package containing the webpack configuration and start-up scripts for the standalone application
- `packages/application` folder: `mercury-application` NPM package defining the specific element for the standalone application front-end.
- `packages/lab` folder: `@mljar/mercury-extension` NPM package defining the JupyterLab extension.

> [!NOTE]
> The repository uses yarn _workspaces_ to handle multiple packages within a single repository. It requires a yarn
> plugin that is installed by default in this repository (in `.yarn/plugins` folder). In case you need to
> update it or install it again, you should refer to the [Yarn documentation](https://yarnpkg.com/cli/plugin/import).

### Watch mode

#### Standalone application

You can watch the source directory of the stand alone application by running in two different terminals the following commands:

```sh
# Watch the application source and automatically rebuilding it when needed
jlpm watch:app
# Run the standalone app in another terminal
python -m mercury_app example.ipynb
```

> [!NOTE]
> Be sure to disable the cache on your web browser and to refresh
> the standalone application web page each time you update the
> code.

#### JupyterLab extension

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch:lib
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall mercury_app
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `@mljar/mercury-extension` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
