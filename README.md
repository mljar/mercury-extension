# Mercury Extension for JupyterLab

Develop web apps from Python notebooks with Mercury directly in JupyterLab.

![](https://github.com/mljar/mercury-extension/blob/main/media/proof-of-concept-demo.gif?raw=true)

## Install

To install the extension, execute:

```bash
pip install mercury_app
```

## Usage

Open a notebook as standalone dashboard:

```bash
python -m mercury_app <path_to_notebook_file>
```

To open the example:

```bash
python -m mercury_app example.ipynb
```

## What to expect

When you open a dashboard,

1. All cells will be rendered in the background.
2. The notebook will be rendered as read-only with dashboard controller widgets in the left sidebar.

When changing a controller widget value, all cells below the
controller will be re-executed (including the cells with controllers).

## Uninstall

To remove the extension, execute:

```bash
pip uninstall mercury_app
```
