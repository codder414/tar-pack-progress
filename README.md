tar-pack-progress
=================

commmand line utility to create archives with progress bar and details. (simlinks support)
## Pros:
- pretty fast
- detailed view
- ships as simple .deb file
- supports arm (tested on Raspberry pi 3b)
## Cons
- doesn't support all linux types of files due to (**tas-fs** restrictions)
- WIP
# Install
```Bash
$ git clone https://github.com/codder414/tar-pack-progress.git
$ cd tar-pack-progress
$ sudo npx  oclif-dev pack:deb # this will generate deb package for various platforms (amd64 and arm64 for now)
$ sudo dpkg -i dist/btar_<platform>*.deb # will include all dependencies (including nodejs itself!)
```
# DEMO

[![asciicast](https://asciinema.org/a/H8gS7qS2lwkSFKhuwn5g7TeVm.svg)](https://asciinema.org/a/H8gS7qS2lwkSFKhuwn5g7TeVm)

<!-- toc -->
* [Install](#install)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g tar-pack-progress
$ btar COMMAND
running command...
$ btar (-v|--version|version)
tar-pack-progress/1.0.6 linux-x64 node-v14.17.0
$ btar --help [COMMAND]
USAGE
  $ btar COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->

<!-- commandsstop -->
